// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { AltiumSchematicFidelityNormalizer } from '../src/convergence/AltiumSchematicFidelityNormalizer.mjs'
import { SchematicSvgRenderer } from '../src/convergence/SchematicSvgRenderer.mjs'

/**
 * Builds a compact native schematic model with structural fidelity features.
 * @returns {Record<string, any>} Native renderer model.
 */
function createNativeFidelityFixture() {
    return {
        summary: { title: 'Fidelity schematic' },
        schematic: {
            sheet: {
                width: 320,
                height: 160,
                sourceWidth: 300,
                sourceHeight: 220,
                marginWidth: 20,
                borderOn: true,
                titleBlockOn: false,
                paperSize: 'A3'
            },
            lines: [
                {
                    x1: 200,
                    y1: 40,
                    x2: 280,
                    y2: 40,
                    ownerIndex: '1',
                    color: '#000080',
                    width: 1
                }
            ],
            polygons: [],
            rectangles: [
                {
                    x: 100,
                    y: 70,
                    width: 8,
                    height: 30,
                    ownerIndex: '42',
                    color: '#000080',
                    fill: '#ffff80',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1
                }
            ],
            roundedRectangles: [],
            ellipses: [],
            arcs: [],
            pies: [],
            texts: [
                {
                    x: 205,
                    y: 150,
                    text: '=organization',
                    rawText: '=organization',
                    resolvedText: '=organization',
                    specialString: {
                        rawText: '=organization',
                        resolvedText: '=organization',
                        parameterNames: ['organization'],
                        expressionParts: [
                            {
                                kind: 'parameter',
                                name: 'organization',
                                value: '=organization'
                            }
                        ]
                    },
                    ownerIndex: '1',
                    recordType: '4',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 0,
                    anchor: 'start'
                },
                {
                    x: 245,
                    y: 150,
                    text: '=ApprovedBy',
                    ownerIndex: '1',
                    recordType: '4',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 0,
                    anchor: 'start'
                },
                {
                    x: 99,
                    y: 70,
                    text: 'R42',
                    ownerIndex: '42',
                    recordType: '34',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 90,
                    anchor: 'start'
                },
                {
                    x: 109,
                    y: 70,
                    text: '62R',
                    ownerIndex: '42',
                    recordType: '41',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 90,
                    anchor: 'start'
                },
                {
                    x: 119,
                    y: 70,
                    text: '0.5W',
                    ownerIndex: '42',
                    recordType: '41',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 90,
                    anchor: 'start'
                },
                {
                    x: 75,
                    y: 145,
                    text: 'DATA_BUS',
                    recordType: '217',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 0,
                    anchor: 'start'
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: [],
            harnesses: {
                connectors: [
                    {
                        key: 'harness-connector-9',
                        recordKey: 'schematic-record-9',
                        x: 40,
                        y: 140,
                        width: 70,
                        height: 40,
                        side: 'left',
                        primaryConnectionPosition: 20,
                        lineWidth: 1,
                        color: '#9fc5e8',
                        fill: '#ffffff'
                    }
                ],
                signalHarnesses: [
                    {
                        points: [
                            { x: 20, y: 120 },
                            { x: 40, y: 120 }
                        ],
                        color: '#9fc5e8',
                        lineWidth: 2
                    }
                ],
                bundleLinks: [
                    {
                        key: 'harness-bundle-0',
                        connectorKey: 'harness-connector-9',
                        signalHarnessKeys: ['signal-harness-13']
                    }
                ]
            },
            ownership: {
                records: [
                    {
                        key: 'schematic-record-1',
                        recordIndex: 1,
                        recordType: '31',
                        fields: { RECORD: '31', SHEETSTYLE: '1' }
                    },
                    {
                        key: 'schematic-record-2',
                        recordIndex: 2,
                        recordType: '4',
                        ownerIndex: '1',
                        fields: {
                            RECORD: '4',
                            OWNERINDEX: '1',
                            'LOCATION.X': '210',
                            'LOCATION.Y': '50'
                        }
                    },
                    {
                        key: 'schematic-record-3',
                        recordIndex: 3,
                        recordType: '41',
                        fields: {
                            RECORD: '41',
                            NAME: 'Organization',
                            TEXT: 'OBSCURA LABS'
                        }
                    },
                    {
                        key: 'schematic-record-4',
                        recordIndex: 4,
                        recordType: '41',
                        fields: {
                            RECORD: '41',
                            NAME: 'ApprovedBy',
                            TEXT: '*'
                        }
                    },
                    {
                        key: 'schematic-record-9',
                        recordIndex: 9,
                        recordType: '215',
                        fields: { RECORD: '215' }
                    },
                    {
                        key: 'schematic-record-10',
                        recordIndex: 10,
                        recordType: '216',
                        fields: {
                            RECORD: '216',
                            OWNERINDEXADDITIONALLIST: 'T',
                            NAME: 'DATA_P',
                            SIDE: '1',
                            DISTANCEFROMTOP: '1',
                            HARNESSTYPE: 'DATA_BUS',
                            TEXTCOLOR: '128'
                        }
                    },
                    {
                        key: 'schematic-record-11',
                        recordIndex: 11,
                        recordType: '216',
                        fields: {
                            RECORD: '216',
                            OWNERINDEXADDITIONALLIST: 'T',
                            NAME: 'DATA_N',
                            SIDE: '1',
                            DISTANCEFROMTOP: '3',
                            HARNESSTYPE: 'DATA_BUS',
                            TEXTCOLOR: '128'
                        }
                    },
                    {
                        key: 'schematic-record-12',
                        recordIndex: 12,
                        recordType: '217',
                        fields: {
                            RECORD: '217',
                            OWNERINDEXADDITIONALLIST: 'T',
                            'LOCATION.X': '65',
                            'LOCATION.Y': '145',
                            TEXT: 'DATA_BUS',
                            COLOR: '128'
                        }
                    },
                    {
                        key: 'schematic-record-13',
                        recordIndex: 13,
                        recordType: '218',
                        fields: { RECORD: '218' }
                    }
                ]
            }
        }
    }
}

/**
 * Builds synthetic pin-bearing symbol groups and one pinless color strip.
 * @returns {Record<string, any>} Native renderer model.
 */
function createThemedSymbolFixture() {
    return {
        summary: { title: 'Themed primitive roles' },
        schematic: {
            sheet: { width: 260, height: 180 },
            lines: [
                {
                    ownerIndex: '302',
                    x1: 220,
                    y1: 80,
                    x2: 212,
                    y2: 86,
                    color: '#000000',
                    width: 1,
                    recordType: '6',
                    renderOrder: 3
                }
            ],
            polygons: [],
            rectangles: [
                {
                    ownerIndex: '301',
                    x: 56,
                    y: 55,
                    width: 8,
                    height: 40,
                    color: '#800000',
                    fill: '#ffffb0',
                    isSolid: true,
                    transparent: true,
                    lineWidth: 1,
                    renderOrder: 2
                },
                {
                    ownerIndex: '302',
                    x: 180,
                    y: 70,
                    width: 40,
                    height: 40,
                    color: '#800000',
                    fill: '#ffffb0',
                    isSolid: true,
                    transparent: true,
                    lineWidth: 1,
                    renderOrder: 2
                },
                {
                    ownerIndex: '302',
                    x: 190,
                    y: 70,
                    width: 20,
                    height: 5,
                    color: '#a44a1b',
                    fill: '#ffe16f',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1,
                    renderOrder: 4
                },
                {
                    ownerIndex: '399',
                    x: 240,
                    y: 40,
                    width: 5,
                    height: 30,
                    color: '#000080',
                    fill: '#800000',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1,
                    renderOrder: 5
                }
            ],
            roundedRectangles: [],
            ellipses: [],
            arcs: [],
            pies: [],
            texts: [],
            components: [],
            pins: [
                {
                    ownerIndex: '301',
                    x: 60,
                    y: 55,
                    length: 10,
                    orientation: 'bottom',
                    name: '1',
                    designator: '1',
                    color: '#000000',
                    labelMode: 'hidden'
                },
                {
                    ownerIndex: '301',
                    x: 60,
                    y: 95,
                    length: 10,
                    orientation: 'top',
                    name: '2',
                    designator: '2',
                    color: '#000000',
                    labelMode: 'hidden'
                },
                {
                    ownerIndex: '302',
                    x: 180,
                    y: 90,
                    length: 10,
                    orientation: 'left',
                    name: '1',
                    designator: '1',
                    color: '#000000',
                    labelMode: 'number-only'
                },
                {
                    ownerIndex: '302',
                    x: 220,
                    y: 90,
                    length: 10,
                    orientation: 'right',
                    name: '2',
                    designator: '2',
                    color: '#000000',
                    labelMode: 'number-only'
                },
                {
                    ownerIndex: '302',
                    x: 200,
                    y: 110,
                    length: 10,
                    orientation: 'top',
                    name: '3',
                    designator: '3',
                    color: '#000000',
                    labelMode: 'number-only'
                }
            ],
            ports: [],
            crosses: []
        }
    }
}

test('convergence schematic fidelity restores native frame, footer, harness, and passive columns', () => {
    const normalized = AltiumSchematicFidelityNormalizer.normalize(
        createNativeFidelityFixture()
    )
    const [connector] = normalized.schematic.harnesses.connectors

    assert.equal(normalized.schematic.sheet.width, 300)
    assert.equal(normalized.schematic.sheet.height, 220)
    assert.equal(
        normalized.schematic.texts.some((text) => text.text === 'OBSCURA LABS'),
        true
    )
    assert.equal(
        normalized.schematic.texts.filter((text) => text.text === '*').length,
        1
    )
    assert.equal(
        normalized.schematic.texts.some((text) => text.recordType === '217'),
        false
    )
    assert.deepEqual(
        connector.entries.map((entry) => [entry.name, entry.distanceFromTop]),
        [
            ['DATA_P', 10],
            ['DATA_N', 30]
        ]
    )
    assert.equal(connector.typeLabel.text, 'DATA_BUS')
    assert.equal(
        normalized.schematic.texts.find((text) => text.text === 'R42').x,
        99
    )
    assert.equal(
        normalized.schematic.texts.find((text) => text.text === '62R').x,
        118
    )
    assert.equal(
        normalized.schematic.texts.find((text) => text.text === '0.5W').x,
        128
    )
})

test('convergence schematic renderer emits complete harness geometry in the existing palette', () => {
    const markup = SchematicSvgRenderer.render(createNativeFidelityFixture())

    assert.match(markup, /viewBox="0 0 300 220"/u)
    assert.match(markup, /class="schematic-signal-harness"/u)
    assert.match(markup, /class="schematic-signal-harness__rail"/u)
    assert.match(markup, /class="schematic-signal-harness__mark"/u)
    assert.match(markup, /class="schematic-harness-connector"/u)
    assert.match(markup, /class="schematic-harness-connector__body"/u)
    assert.match(markup, /class="schematic-harness-connector__bracket"/u)
    assert.match(markup, /class="schematic-harness-entry"/u)
    assert.match(markup, /class="schematic-harness-entry-dot"/u)
    assert.match(markup, />DATA_P</u)
    assert.match(markup, />DATA_N</u)
    assert.match(markup, /class="schematic-harness-type"/u)
    assert.match(markup, />DATA_BUS</u)
    assert.match(
        markup,
        /class="schematic-harness-entry-label" x="102"[^>]*fill="var\(--schematic-default-ink-color\)" text-anchor="end"/u
    )
    assert.match(
        markup,
        /class="schematic-harness-entry-dot" cx="110"[^>]*fill="var\(--schematic-default-ink-color\)"/u
    )
    assert.match(markup, /stroke="var\(--schematic-accent-ink-color\)"/u)
    assert.match(markup, /fill="var\(--schematic-pin-marker-fill\)"/u)
    assert.doesNotMatch(markup, /#9fc5e8/iu)
    assert.match(markup, /class="schematic-label" x="99"[^>]*>R42</u)
    assert.match(markup, /class="schematic-label" x="118"[^>]*>62R</u)
    assert.match(markup, /class="schematic-label" x="128"[^>]*>0\.5W</u)
    assert.doesNotMatch(markup, /style="[^";]*color:/u)
})

test('convergence schematic renderer themes pin-bearing symbol primitive roles', () => {
    const markup = SchematicSvgRenderer.render(createThemedSymbolFixture())

    assert.match(
        markup,
        /<rect class="schematic-rectangle" x="56" y="85" width="8" height="40" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)"/u
    )
    assert.match(
        markup,
        /<rect class="schematic-rectangle" x="180" y="70" width="40" height="40" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)"/u
    )
    assert.match(
        markup,
        /<rect class="schematic-rectangle" x="190" y="105" width="20" height="5" fill="var\(--schematic-power-color\)" stroke="var\(--schematic-power-color\)"/u
    )
    assert.match(
        markup,
        /<line x1="220" y1="100" x2="212" y2="94" stroke="var\(--schematic-power-color\)"/u
    )
    assert.match(
        markup,
        /<rect class="schematic-rectangle" x="240" y="110" width="5" height="30" fill="#6f2a2a" stroke="#2a2a6f"/u
    )
    assert.doesNotMatch(markup, /#d2d289|#d2c389|#8a5235/iu)
})

test('project context preserves native footer metadata fallback values', () => {
    const markup = SchematicSvgRenderer.render(createNativeFidelityFixture(), {
        projectParameters: {
            CurrentDate: '1/2/2026',
            DocumentName: 'neutral.SchDoc'
        }
    })

    assert.match(markup, />OBSCURA LABS</u)
    assert.doesNotMatch(markup, />=organization</u)
})
