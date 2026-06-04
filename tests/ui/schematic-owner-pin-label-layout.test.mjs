// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicOwnerPinLabelLayout } from '../../src/ui/SchematicOwnerPinLabelLayout.mjs'

/**
 * Verifies public pin-label placement matches the renderer's native-facing
 * horizontal label spacing.
 */
test('SchematicOwnerPinLabelLayout resolves horizontal native pin text placement', () => {
    assert.deepEqual(
        SchematicOwnerPinLabelLayout.resolveNativePinTextPlacement(
            {
                x: 100,
                y: 50,
                length: 40,
                orientation: 'left',
                symbolOuter: 34
            },
            'number'
        ),
        {
            x: 83,
            yOffset: -1,
            anchor: 'end',
            rotation: 0
        }
    )
    assert.deepEqual(
        SchematicOwnerPinLabelLayout.resolveNativePinTextPlacement(
            {
                x: 100,
                y: 50,
                length: 40,
                orientation: 'right'
            },
            'name'
        ),
        {
            x: 92,
            yOffset: 3,
            anchor: 'end',
            rotation: 0
        }
    )
})

/**
 * Verifies vertical pin labels expose stable rotation and anchor decisions for
 * renderer and consumer tests.
 */
test('SchematicOwnerPinLabelLayout resolves vertical native pin text placement', () => {
    assert.deepEqual(
        SchematicOwnerPinLabelLayout.resolveNativePinTextPlacement(
            {
                x: 120,
                y: 80,
                length: 20,
                orientation: 'top'
            },
            'name',
            { rotateTopNumber: false }
        ),
        {
            x: 120,
            yOffset: 4,
            anchor: 'end',
            rotation: -90
        }
    )
    assert.deepEqual(
        SchematicOwnerPinLabelLayout.resolveNativePinTextPlacement(
            {
                x: 120,
                y: 80,
                length: 20,
                orientation: 'bottom'
            },
            'number'
        ),
        {
            x: 118,
            yOffset: 7,
            anchor: 'middle',
            rotation: -90
        }
    )
})
