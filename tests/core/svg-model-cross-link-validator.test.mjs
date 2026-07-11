// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import {
    PcbSvgRenderer,
    SchematicSvgRenderer,
    SvgModelCrossLinkValidator
} from '../../src/extensions.mjs'

/**
 * Creates a schematic model with addressable visible primitives.
 * @returns {object}
 */
function createSchematicModel() {
    const line = {
        recordId: 'wire-1',
        x1: 20,
        y1: 40,
        x2: 120,
        y2: 40,
        width: 1
    }
    const label = {
        recordId: 'label-1',
        recordType: '25',
        x: 70,
        y: 40,
        text: 'NET_A'
    }
    const pin = {
        recordId: 'pin-1',
        ownerIndex: '1',
        designator: '1',
        name: 'IN',
        x: 140,
        y: 40,
        length: 20,
        orientation: 'left'
    }

    return {
        kind: 'schematic',
        fileType: 'SchDoc',
        fileName: 'linked.SchDoc',
        summary: { title: 'Linked schematic' },
        diagnostics: [],
        schematic: {
            sheet: { width: 180, height: 100 },
            lines: [line],
            texts: [label],
            components: [
                {
                    recordId: 'component-1',
                    ownerIndex: '1',
                    designator: 'U1',
                    uniqueId: 'U1-UID'
                }
            ],
            pins: [pin],
            ports: [],
            crosses: [],
            nets: [
                {
                    name: 'NET_A',
                    segments: [line],
                    labels: [label],
                    pins: [pin],
                    ports: [],
                    junctions: [],
                    busEntries: [],
                    sheetEntries: []
                }
            ]
        }
    }
}

/**
 * Creates a PCB model with addressable visible primitives.
 * @returns {object}
 */
function createPcbModel() {
    return {
        kind: 'pcb',
        fileType: 'PcbDoc',
        fileName: 'linked.PcbDoc',
        diagnostics: [],
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 200,
                heightMil: 100,
                segments: []
            },
            layers: [{ id: 1, name: 'Top Layer', role: 'copper' }],
            nets: [{ netIndex: 0, name: 'NET_A' }],
            tracks: [
                {
                    x1: 20,
                    y1: 40,
                    x2: 100,
                    y2: 40,
                    width: 8,
                    layerId: 1,
                    net: 'NET_A'
                }
            ],
            vias: [
                {
                    x: 100,
                    y: 40,
                    diameter: 18,
                    holeDiameter: 8,
                    layerId: 1,
                    net: 'NET_A'
                }
            ],
            pads: [],
            texts: [],
            components: []
        }
    }
}

test('SvgModelCrossLinkValidator verifies schematic SVG data links', () => {
    const model = createSchematicModel()
    const svg = SchematicSvgRenderer.render(model)
    const report = SvgModelCrossLinkValidator.validate(model, svg)

    assert.equal(report.schema, 'altium-toolkit.svg-model-cross-link.a1')
    assert.equal(report.documentKind, 'schematic')
    assert.equal(report.summary.expectedElementCount, 3)
    assert.equal(report.summary.missingElementCount, 0)
    assert.equal(report.summary.orphanElementCount, 0)
    assert.equal(report.summary.unresolvedReferenceCount, 0)
})

test('SvgModelCrossLinkValidator reports missing and orphan schematic links', () => {
    const model = createSchematicModel()
    const svg = SchematicSvgRenderer.render(model).replace(
        /data-element-key="schematic-line-0"/u,
        'data-element-key="schematic-line-unknown"'
    )
    const report = SvgModelCrossLinkValidator.validate(model, svg)

    assert.ok(
        report.missingElements.some(
            (element) => element.elementKey === 'schematic-line-0'
        )
    )
    assert.ok(
        report.orphanElements.some(
            (element) => element.elementKey === 'schematic-line-unknown'
        )
    )
})

test('SvgModelCrossLinkValidator verifies PCB SVG data links', () => {
    const model = createPcbModel()
    const svg = PcbSvgRenderer.render(model)
    const report = SvgModelCrossLinkValidator.validate(model, svg)

    assert.equal(report.documentKind, 'pcb')
    assert.equal(report.summary.expectedElementCount, 2)
    assert.equal(report.summary.missingElementCount, 0)
    assert.equal(report.summary.orphanElementCount, 0)
    assert.equal(report.summary.unresolvedReferenceCount, 0)
})
