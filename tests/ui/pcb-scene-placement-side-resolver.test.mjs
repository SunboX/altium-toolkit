// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dPlacementSideResolver } from '../../src/ui/PcbScene3dPlacementSideResolver.mjs'

/**
 * Builds one fake component-body identity with many token fragments.
 * @returns {object}
 */
function buildTokenHeavyBody() {
    return {
        identifier: 'FAKE_QFN_PACKAGE_BODY_1234567890'.repeat(4),
        name: 'FAKE_MODEL_DEFAULT_BLACK_STEP_BODY_1234567890.stp'.repeat(4)
    }
}

/**
 * Builds one fake component identity with many package metadata fragments.
 * @returns {object}
 */
function buildTokenHeavyComponent() {
    return {
        pattern: 'FAKE_QFN_PACKAGE_PATTERN_1234567890'.repeat(4),
        source: 'FAKE_SOURCE_MODEL_DEFAULT_BLACK_PACKAGE_1234567890'.repeat(4),
        modelPath: 'fake/path/FAKE_QFN_PACKAGE_BODY_1234567890.step'.repeat(4),
        description:
            'FAKE TEST COMPONENT WITH MANY TOKEN FRAGMENTS 1234567890 '.repeat(
                8
            ),
        parameters: {
            'Package / Case': 'FAKE_QFN_PACKAGE_1234567890'.repeat(4),
            'Supplier Device Package':
                'FAKE_SUPPLIER_DEVICE_PACKAGE_1234567890'.repeat(4),
            'Part Description':
                'FAKE_PART_DESCRIPTION_PACKAGE_1234567890'.repeat(4),
            Package: 'FAKE_PACKAGE_1234567890'.repeat(4)
        },
        provenance: {
            footprintDescription:
                'FAKE_FOOTPRINT_DESCRIPTION_PACKAGE_1234567890'.repeat(4),
            sourceLibReference:
                'FAKE_SOURCE_LIB_REFERENCE_PACKAGE_1234567890'.repeat(4),
            sourceFootprintLibrary:
                'FAKE_SOURCE_FOOTPRINT_LIBRARY_PACKAGE_1234567890'.repeat(4),
            sourceFootprintLibraryName:
                'FAKE_SOURCE_FOOTPRINT_LIBRARY_NAME_PACKAGE_1234567890'.repeat(
                    4
                )
        }
    }
}

test('PcbScene3dPlacementSideResolver scores repeated body/component affinity without repeated token scans', () => {
    const body = buildTokenHeavyBody()
    const component = buildTokenHeavyComponent()
    const expectedScore =
        PcbScene3dPlacementSideResolver.scoreBodyComponentAffinity(
            body,
            component
        )
    const iterations = 10000
    const startedAt = performance.now()
    let scoreTotal = 0

    for (let index = 0; index < iterations; index += 1) {
        scoreTotal +=
            PcbScene3dPlacementSideResolver.scoreBodyComponentAffinity(
                body,
                component
            )
    }

    const elapsedMs = performance.now() - startedAt

    assert.equal(scoreTotal, expectedScore * iterations)
    assert.ok(
        elapsedMs < 500,
        'Expected repeated affinity scoring under 500ms, got ' +
            Math.round(elapsedMs) +
            'ms'
    )
})

test('PcbScene3dPlacementSideResolver ignores impossible standoff side when authored dz is valid', () => {
    const side = PcbScene3dPlacementSideResolver.resolvePlacementSide(
        {
            identifier: 'atlas_edge_socket_body',
            name: 'atlas-edge-socket-body.step',
            positionMil: { x: 520, y: 250 },
            dzMil: -60,
            overallHeightMil: 70,
            standoffHeightMil: -105
        },
        null,
        [
            {
                layer: 'TOP',
                pattern: 'ATLAS_EDGE_SOCKET',
                source: 'CON/ATLAS_EDGE_SOCKET',
                x: 560,
                y: 250
            }
        ],
        {
            minX: 0,
            minY: 0,
            widthMil: 1000,
            heightMil: 500
        }
    )

    assert.equal(side, 'top')
})
