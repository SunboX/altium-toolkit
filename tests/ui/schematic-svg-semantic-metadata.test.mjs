// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicRenderOpsSidecarBuilder } from '../../src/ui/SchematicRenderOpsSidecarBuilder.mjs'
import { SchematicSvgRenderer } from '../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Decodes a JSON metadata block from SVG markup.
 * @param {string} markup SVG markup.
 * @param {string} id Metadata element id.
 * @returns {object}
 */
function readMetadata(markup, id) {
    const match = markup.match(
        new RegExp('<metadata id="' + id + '"[^>]*>([^<]+)</metadata>', 'u')
    )
    assert.ok(match, 'metadata block is present')

    return JSON.parse(
        match[1]
            .replace(/&quot;/gu, '"')
            .replace(/&amp;/gu, '&')
            .replace(/&lt;/gu, '<')
            .replace(/&gt;/gu, '>')
    )
}

/**
 * Verifies schematic SVG output exposes stable semantic hooks for downstream
 * net and component highlighting.
 */
test('SchematicSvgRenderer emits semantic data attributes and metadata sidecar', () => {
    const line = {
        recordId: 'wire-1',
        x1: 80,
        y1: 80,
        x2: 120,
        y2: 80,
        color: '#000080',
        width: 1
    }
    const label = {
        recordId: 'label-1',
        recordType: '25',
        x: 100,
        y: 80,
        text: 'NET_A',
        color: '#000080'
    }
    const pin = {
        recordId: 'pin-1',
        ownerIndex: '10',
        x: 140,
        y: 80,
        length: 20,
        name: 'IN',
        designator: '1',
        orientation: 'left',
        color: '#0000ff',
        labelColor: '#1f1f1f',
        labelMode: 'name-and-number'
    }

    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Semantic schematic' },
        schematic: {
            sheet: { width: 220, height: 140 },
            lines: [line],
            texts: [label],
            components: [
                {
                    recordId: 'component-1',
                    ownerIndex: '10',
                    x: 150,
                    y: 80,
                    designator: 'U1',
                    uniqueId: 'COMP-1'
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
    })

    assert.match(
        markup,
        /data-semantic-schema="altium-toolkit\.schematic\.svg\.semantics\.a1"/
    )
    assert.match(
        markup,
        /<metadata id="schematic-semantic-metadata" data-schema="altium-toolkit\.schematic\.svg\.semantics\.a1">/
    )
    assert.match(markup, /data-record-id="wire-1"/)
    assert.match(markup, /data-element-key="schematic-line-0"/)
    assert.match(markup, /data-record-id="pin-1"/)
    assert.match(markup, /data-element-key="schematic-pin-0"/)
    assert.match(markup, /data-component="U1"/)
    assert.match(markup, /data-component-unique-id="COMP-1"/)
    assert.match(markup, /data-pin="1"/)
    assert.match(markup, /data-net="NET_A"/)

    const metadata = readMetadata(markup, 'schematic-semantic-metadata')

    assert.equal(metadata.schema, 'altium-toolkit.schematic.svg.semantics.a1')
    assert.deepEqual(metadata.nets, [
        {
            name: 'NET_A',
            elementKeys: [
                'schematic-line-0',
                'schematic-text-0',
                'schematic-pin-0'
            ],
            components: ['U1'],
            pins: ['U1:1']
        }
    ])
    assert.deepEqual(metadata.components, [
        {
            designator: 'U1',
            uniqueId: 'COMP-1',
            elementKeys: ['schematic-component-0', 'schematic-pin-0'],
            pins: ['1'],
            nets: ['NET_A']
        }
    ])
})

/**
 * Verifies schematic SVG rendering can resolve project parameters in visible
 * text and title-block fields without changing the input model.
 */
test('SchematicSvgRenderer resolves project parameters for schematic text and title block', () => {
    const documentModel = {
        summary: { title: 'Parameter schematic' },
        schematic: {
            sheet: {
                width: 240,
                height: 160,
                borderOn: true,
                titleBlockOn: true,
                titleBlock: {
                    title: '.ProjectTitle + " " + .Revision',
                    documentNumber: '=DocumentNumber'
                }
            },
            texts: [
                {
                    recordId: 'label-1',
                    x: 80,
                    y: 80,
                    text: '.ProjectTitle',
                    color: '#000080'
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: [],
            nets: []
        }
    }

    const markup = SchematicSvgRenderer.render(documentModel, {
        projectParameters: {
            ProjectTitle: 'FROST MODULE',
            Revision: 'B2',
            DocumentNumber: 'DWG-9'
        }
    })

    assert.match(markup, />FROST MODULE</)
    assert.match(markup, />FROST MODULE B2</)
    assert.match(markup, />DWG-9</)
    assert.equal(
        documentModel.schematic.sheet.titleBlock.title,
        '.ProjectTitle + " " + .Revision'
    )
})

/**
 * Verifies schematic SVG callers can select an export profile that omits the
 * root viewBox while still carrying document identity and text geometry
 * sidecars for deterministic review tooling.
 */
test('SchematicSvgRenderer supports export profile metadata and text geometry sidecars', () => {
    const markup = SchematicSvgRenderer.render(
        {
            fileName: 'profile-sheet.SchDoc',
            summary: { title: 'Profile schematic' },
            schematic: {
                sheet: { width: 220, height: 140 },
                lines: [],
                texts: [
                    {
                        recordId: 'title-1',
                        x: 40,
                        y: 90,
                        text: 'PROFILE',
                        color: '#000080',
                        fontSize: 12,
                        fontFamily: 'Times New Roman',
                        fontWeight: 700
                    }
                ],
                components: [],
                pins: [],
                ports: [],
                crosses: [],
                nets: []
            }
        },
        {
            includeViewBox: false,
            documentId: 'doc-profile-1',
            documentVersion: 'rev-a',
            includeTextGeometrySidecar: true
        }
    )

    assert.doesNotMatch(markup, /<svg class="schematic-svg" viewBox=/)
    assert.match(markup, /data-doc-id="doc-profile-1"/)
    assert.match(markup, /data-doc-ver="rev-a"/)
    assert.match(
        markup,
        /<metadata id="schematic-text-geometry" data-schema="altium-toolkit\.text-geometry\.a1">/
    )

    const geometry = readMetadata(markup, 'schematic-text-geometry')

    assert.deepEqual(geometry.entries, [
        {
            elementKey: 'schematic-text-0',
            recordId: 'title-1',
            text: 'PROFILE',
            fontFamily: 'Times New Roman',
            fontSize: 12,
            fontWeight: 700,
            geometryKind: 'estimated-bounds-polygon',
            polygon: [
                { x: 40, y: 90 },
                { x: 90.4, y: 90 },
                { x: 90.4, y: 76 },
                { x: 40, y: 76 }
            ]
        }
    ])
})

test('SchematicSvgRenderer emits element metadata for schematic primitive families', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Primitive semantic schematic' },
        schematic: {
            sheet: { width: 260, height: 180 },
            lines: [],
            polygons: [],
            rectangles: [],
            roundedRectangles: [
                {
                    recordId: 'round-1',
                    ownerIndex: '10',
                    x: 20,
                    y: 40,
                    width: 60,
                    height: 30,
                    radius: 6,
                    color: '#000080',
                    fill: '#ffffff',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1
                }
            ],
            ellipses: [],
            arcs: [],
            beziers: [
                {
                    recordId: 'curve-1',
                    points: [],
                    segments: [
                        {
                            start: { x: 90, y: 50 },
                            control1: { x: 100, y: 80 },
                            control2: { x: 120, y: 80 },
                            end: { x: 130, y: 50 }
                        }
                    ],
                    color: '#000080',
                    width: 1
                }
            ],
            pies: [
                {
                    recordId: 'pie-1',
                    x: 170,
                    y: 60,
                    radius: 20,
                    radiusY: 15,
                    startAngle: 0,
                    endAngle: 90,
                    color: '#000080',
                    fill: '#ffff00',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1
                }
            ],
            ieeeSymbols: [
                {
                    recordId: 'ieee-1',
                    x: 210,
                    y: 70,
                    symbol: 4,
                    symbolName: 'inverter',
                    size: 16,
                    color: '#000080',
                    lineWidth: 1
                }
            ],
            directives: [
                {
                    recordId: 'directive-1',
                    x: 120,
                    y: 120,
                    color: '#ff0000',
                    name: 'DIFFPAIR'
                }
            ],
            texts: [
                {
                    recordId: 'frame-1',
                    recordType: '28',
                    x: 20,
                    y: 150,
                    cornerX: 90,
                    cornerY: 120,
                    text: 'FRAME',
                    color: '#000080',
                    fill: '#ffffff',
                    showBorder: true,
                    isSolid: true,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400
                }
            ],
            components: [
                {
                    recordId: 'component-1',
                    ownerIndex: '10',
                    x: 50,
                    y: 60,
                    designator: 'U1'
                }
            ],
            pins: [],
            ports: [],
            crosses: [],
            nets: []
        }
    })

    assert.match(markup, /data-primitive="rounded-rectangle"/)
    assert.match(markup, /data-primitive="bezier"/)
    assert.match(markup, /data-primitive="pie"/)
    assert.match(markup, /data-primitive="ieee-symbol"/)
    assert.match(markup, /data-primitive="directive"/)

    const metadata = readMetadata(markup, 'schematic-semantic-metadata')

    assert.deepEqual(
        metadata.elements.map((entry) => ({
            elementKey: entry.elementKey,
            primitive: entry.primitive,
            recordId: entry.recordId,
            component: entry.component
        })),
        [
            {
                elementKey: 'schematic-rounded-rectangle-0',
                primitive: 'rounded-rectangle',
                recordId: 'round-1',
                component: 'U1'
            },
            {
                elementKey: 'schematic-bezier-0',
                primitive: 'bezier',
                recordId: 'curve-1',
                component: undefined
            },
            {
                elementKey: 'schematic-pie-0',
                primitive: 'pie',
                recordId: 'pie-1',
                component: undefined
            },
            {
                elementKey: 'schematic-ieee-symbol-0',
                primitive: 'ieee-symbol',
                recordId: 'ieee-1',
                component: undefined
            },
            {
                elementKey: 'schematic-text-0',
                primitive: 'text-frame',
                recordId: 'frame-1',
                component: undefined
            },
            {
                elementKey: 'schematic-component-0',
                primitive: 'component',
                recordId: 'component-1',
                component: 'U1'
            },
            {
                elementKey: 'schematic-directive-0',
                primitive: 'directive',
                recordId: 'directive-1',
                component: undefined
            }
        ]
    )
})

test('SchematicSvgRenderer emits optional schematic render-operation sidecars', () => {
    const markup = SchematicSvgRenderer.render(
        {
            summary: { title: 'Render ops schematic' },
            schematic: {
                sheet: { width: 180, height: 120 },
                lines: [
                    {
                        recordId: 'line-1',
                        x1: 20,
                        y1: 40,
                        x2: 80,
                        y2: 40,
                        color: '#000080',
                        width: 2
                    }
                ],
                rectangles: [
                    {
                        recordId: 'rect-1',
                        x: 30,
                        y: 90,
                        width: 40,
                        height: 20,
                        color: '#008000',
                        fill: '#ffffff',
                        isSolid: true,
                        transparent: false,
                        lineWidth: 1
                    }
                ],
                texts: [
                    {
                        recordId: 'text-1',
                        x: 30,
                        y: 30,
                        text: 'NET_A',
                        color: '#000080',
                        fontSize: 10,
                        fontFamily: 'Arial'
                    }
                ],
                components: [],
                pins: [],
                ports: [],
                crosses: [],
                nets: []
            }
        },
        { renderOperations: 'sidecar', renderOperationProfile: 'onscreen' }
    )

    const metadata = readMetadata(markup, 'schematic-render-operations')

    assert.deepEqual(metadata, {
        schema: 'altium-toolkit.schematic.render-ops.a1',
        profile: 'onscreen',
        coordinateSpace: {
            x: 'svg',
            y: 'svg',
            units: 'schematic-display-units'
        },
        summary: {
            recordCount: 3,
            operationCount: 3,
            failedRecordCount: 0
        },
        records: [
            {
                elementKey: 'schematic-line-0',
                recordId: 'line-1',
                primitive: 'line',
                operations: [
                    {
                        type: 'line',
                        x1: 20,
                        y1: 80,
                        x2: 80,
                        y2: 80,
                        stroke: '#000080',
                        width: 2
                    }
                ]
            },
            {
                elementKey: 'schematic-rectangle-0',
                recordId: 'rect-1',
                primitive: 'rectangle',
                operations: [
                    {
                        type: 'rectangle',
                        x: 30,
                        y: 10,
                        width: 40,
                        height: 20,
                        stroke: '#008000',
                        fill: '#ffffff',
                        widthStroke: 1
                    }
                ]
            },
            {
                elementKey: 'schematic-text-0',
                recordId: 'text-1',
                primitive: 'text',
                operations: [
                    {
                        type: 'string',
                        x: 30,
                        y: 90,
                        text: 'NET_A',
                        fill: '#000080',
                        fontFamily: 'Arial',
                        fontSize: 10
                    }
                ]
            }
        ]
    })
})

test('SchematicRenderOpsSidecarBuilder covers schematic shape and asset primitives', () => {
    const metadata = SchematicRenderOpsSidecarBuilder.build(
        {
            roundedRectangles: [
                {
                    recordId: 'round-1',
                    x: 10,
                    y: 30,
                    width: 40,
                    height: 20,
                    radius: 4,
                    color: '#000080',
                    fill: '#ffffff',
                    lineWidth: 1
                }
            ],
            ellipses: [
                {
                    recordId: 'ellipse-1',
                    x: 80,
                    y: 30,
                    radiusX: 12,
                    radiusY: 8,
                    color: '#000080',
                    fill: '#ffff00',
                    lineWidth: 1
                }
            ],
            arcs: [
                {
                    recordId: 'arc-1',
                    x: 120,
                    y: 40,
                    radius: 20,
                    startAngle: 0,
                    endAngle: 90,
                    color: '#000080',
                    width: 2
                }
            ],
            beziers: [
                {
                    recordId: 'bezier-1',
                    segments: [
                        {
                            start: { x: 20, y: 80 },
                            control1: { x: 30, y: 100 },
                            control2: { x: 50, y: 100 },
                            end: { x: 60, y: 80 }
                        }
                    ],
                    color: '#008000',
                    width: 1
                }
            ],
            pies: [
                {
                    recordId: 'pie-1',
                    x: 100,
                    y: 90,
                    radius: 18,
                    radiusY: 12,
                    startAngle: 15,
                    endAngle: 120,
                    color: '#000080',
                    fill: '#ffee00',
                    lineWidth: 1
                }
            ],
            images: [
                {
                    recordId: 'image-1',
                    x: 140,
                    y: 100,
                    width: 30,
                    height: 20,
                    nativeFormat: 'PNG'
                }
            ],
            texts: []
        },
        { contentHeight: 140, profile: 'ops-expanded' }
    )

    assert.equal(metadata.summary.recordCount, 6)
    assert.equal(metadata.summary.operationCount, 6)
    assert.deepEqual(
        metadata.records.map((record) => ({
            recordId: record.recordId,
            primitive: record.primitive,
            operation: record.operations[0]
        })),
        [
            {
                recordId: 'round-1',
                primitive: 'rounded-rectangle',
                operation: {
                    type: 'rounded-rectangle',
                    x: 10,
                    y: 90,
                    width: 40,
                    height: 20,
                    radius: 4,
                    stroke: '#000080',
                    fill: '#ffffff',
                    widthStroke: 1
                }
            },
            {
                recordId: 'ellipse-1',
                primitive: 'ellipse',
                operation: {
                    type: 'ellipse',
                    cx: 80,
                    cy: 110,
                    rx: 12,
                    ry: 8,
                    stroke: '#000080',
                    fill: '#ffff00',
                    widthStroke: 1
                }
            },
            {
                recordId: 'arc-1',
                primitive: 'arc',
                operation: {
                    type: 'arc',
                    cx: 120,
                    cy: 100,
                    radius: 20,
                    startAngle: 0,
                    endAngle: 90,
                    stroke: '#000080',
                    width: 2
                }
            },
            {
                recordId: 'bezier-1',
                primitive: 'bezier',
                operation: {
                    type: 'bezier',
                    segments: [
                        {
                            start: { x: 20, y: 60 },
                            control1: { x: 30, y: 40 },
                            control2: { x: 50, y: 40 },
                            end: { x: 60, y: 60 }
                        }
                    ],
                    stroke: '#008000',
                    width: 1
                }
            },
            {
                recordId: 'pie-1',
                primitive: 'pie',
                operation: {
                    type: 'pie',
                    cx: 100,
                    cy: 50,
                    radiusX: 18,
                    radiusY: 12,
                    startAngle: 15,
                    endAngle: 120,
                    stroke: '#000080',
                    fill: '#ffee00',
                    widthStroke: 1
                }
            },
            {
                recordId: 'image-1',
                primitive: 'image',
                operation: {
                    type: 'image',
                    x: 140,
                    y: 20,
                    width: 30,
                    height: 20,
                    nativeFormat: 'PNG'
                }
            }
        ]
    )
})
