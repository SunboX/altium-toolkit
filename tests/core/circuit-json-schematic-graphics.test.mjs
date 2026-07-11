// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { SchematicSvgRenderer } from 'circuitjson-toolkit/renderers'

import { CircuitJsonModelAdapter } from '../../src/core/circuit-json/CircuitJsonModelAdapter.mjs'
import { AltiumCircuitJsonProjection } from '../../src/convergence/AltiumCircuitJsonProjection.mjs'
import { AltiumDocumentBuilder } from '../../src/convergence/AltiumDocumentBuilder.mjs'
import { AltiumSchematicCoordinateProjection } from '../../src/convergence/AltiumSchematicCoordinateProjection.mjs'
import { Parser } from '../../src/convergence/Parser.mjs'

/**
 * Builds one source-neutral renderer model containing every supported native
 * Altium schematic graphic family.
 * @returns {Record<string, unknown>}
 */
function graphicRendererModel() {
    return {
        sourceFormat: 'altium',
        kind: 'schematic',
        fileType: 'SchDoc',
        fileName: 'graphic-contract.SchDoc',
        summary: { title: 'Graphic contract' },
        diagnostics: [],
        schematic: {
            sheet: { width: 200, height: 120 },
            components: [
                {
                    designator: 'U1',
                    uniqueId: 'component-a',
                    x: 30,
                    y: 30,
                    width: 10,
                    height: 8,
                    rotation: 90,
                    schematicDesignatorVisible: false
                }
            ],
            pins: [],
            nets: [],
            ownership: {
                records: [
                    {
                        recordIndex: 0,
                        recordType: '1',
                        uniqueId: 'component-a',
                        fields: {
                            RECORD: '1',
                            UniqueID: 'component-a',
                            'Location.X': '30',
                            'Location.Y': '30'
                        }
                    },
                    {
                        recordIndex: 1,
                        recordType: '14',
                        ownerIndex: '700',
                        fields: {
                            RECORD: '14',
                            OwnerIndex: '700',
                            OwnerPartId: '1',
                            'Location.X': '25',
                            'Location.Y': '26',
                            'Corner.X': '35',
                            'Corner.Y': '34'
                        }
                    }
                ]
            },
            lines: [
                {
                    x1: 25,
                    y1: 30,
                    x2: 35,
                    y2: 30,
                    color: '#112233',
                    width: 0.3,
                    lineStyle: 3,
                    ownerIndex: '700',
                    renderOrder: 1
                }
            ],
            rectangles: [
                {
                    x: 25,
                    y: 26,
                    width: 10,
                    height: 8,
                    color: '#223344',
                    fill: '#ddeeff',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 0.2,
                    lineStyle: 1,
                    ownerIndex: '700',
                    renderOrder: 2
                }
            ],
            roundedRectangles: [
                {
                    x: 40,
                    y: 10,
                    width: 12,
                    height: 8,
                    radius: 2,
                    color: '#334455',
                    fill: '#ccddee',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 0.25,
                    lineStyle: 0,
                    renderOrder: 3
                }
            ],
            ellipses: [
                {
                    x: 60,
                    y: 10,
                    radiusX: 3,
                    radiusY: 3,
                    color: '#445566',
                    fill: '#bbccdd',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 0.1,
                    renderOrder: 4
                },
                {
                    x: 70,
                    y: 10,
                    radiusX: 4,
                    radiusY: 2,
                    color: '#556677',
                    fill: '#aabbcc',
                    isSolid: false,
                    transparent: true,
                    lineWidth: 0.15,
                    renderOrder: 5
                }
            ],
            arcs: [
                {
                    x: 80,
                    y: 10,
                    radius: 5,
                    startAngle: 0,
                    endAngle: 90,
                    color: '#667788',
                    width: 0.12,
                    ownerIndex: '700',
                    renderOrder: 6
                },
                {
                    x: 90,
                    y: 10,
                    radius: 5,
                    radiusY: 3,
                    startAngle: 0,
                    endAngle: 180,
                    color: '#778899',
                    width: 0.13,
                    renderOrder: 7
                }
            ],
            pies: [
                {
                    x: 100,
                    y: 20,
                    radius: 5,
                    radiusY: 3,
                    startAngle: 0,
                    endAngle: 180,
                    color: '#aabbcc',
                    fill: '#ccbbaa',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 0.2,
                    renderOrder: 7.5
                }
            ],
            beziers: [
                {
                    segments: [
                        {
                            start: { x: 0, y: 20 },
                            control1: { x: 2, y: 16 },
                            control2: { x: 4, y: 24 },
                            end: { x: 6, y: 20 }
                        }
                    ],
                    color: '#8899aa',
                    width: 0.18,
                    lineStyle: 1,
                    renderOrder: 8
                }
            ],
            polygons: [
                {
                    points: [
                        { x: 10, y: 20 },
                        { x: 16, y: 20 },
                        { x: 13, y: 26 }
                    ],
                    color: '#99aabb',
                    fill: '#8899aa',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 0.22,
                    renderOrder: 9
                }
            ],
            texts: [
                {
                    recordType: '28',
                    text: 'BOXED NOTE',
                    x: 20,
                    y: 50,
                    cornerX: 50,
                    cornerY: 40,
                    fontSize: 1.1,
                    color: '#123456',
                    borderColor: '#654321',
                    fill: '#fff0aa',
                    isSolid: true,
                    showBorder: true,
                    lineWidth: 0.2,
                    textMargin: 2,
                    renderOrder: 10
                }
            ],
            textFrames: [
                {
                    x: 20,
                    y: 50,
                    cornerX: 50,
                    cornerY: 40,
                    width: 30,
                    height: 10,
                    text: 'BOXED NOTE',
                    alignment: 'left',
                    borderWidth: 0.2,
                    color: '#123456',
                    borderColor: '#654321',
                    fill: '#fff0aa',
                    isSolid: true,
                    showBorder: true,
                    font: { size: 1.1, family: 'Arial', weight: 400 },
                    textMargin: 2,
                    rotation: 90,
                    renderOrder: 10
                }
            ],
            sheetSymbols: [
                {
                    x: 100,
                    y: 80,
                    width: 40,
                    height: 20,
                    name: 'Child',
                    fileName: 'child.SchDoc',
                    uniqueId: 'sheet-a',
                    renderOrder: 11
                },
                {
                    x: 150,
                    y: 80,
                    width: 30,
                    height: 20,
                    name: 'Child B',
                    fileName: 'child-b.SchDoc',
                    uniqueId: 'sheet-b',
                    renderOrder: 13
                }
            ],
            sheetEntries: [
                {
                    ownerIndex: '11',
                    name: 'IN',
                    side: 'left',
                    direction: 'input',
                    x: 100,
                    y: 70,
                    renderOrder: 12
                },
                {
                    ownerIndex: '13',
                    name: 'OUT',
                    side: 'left',
                    direction: 'output',
                    x: 150,
                    y: 70,
                    renderOrder: 14
                }
            ],
            images: []
        },
        bom: []
    }
}

/**
 * Finds the first canonical element of one type.
 * @param {object[]} model CircuitJSON model.
 * @param {string} type Element type.
 * @returns {object}
 */
function first(model, type) {
    const element = model.find((candidate) => candidate.type === type)
    assert.ok(element, `Expected ${type}.`)
    return element
}

test('AltiumSchematicCoordinateProjection reflects three-point arcs without inventing fields', () => {
    const pcb = {
        type: 'pcb_board',
        pcb_board_id: 'board',
        center: { x: 1, y: 2 },
        width: 4,
        height: 3
    }
    const source = {
        type: 'source_component',
        source_component_id: 'source',
        name: 'Source',
        ftype: 'simple_chip',
        metadata: { y: 7 }
    }
    const [arc, projectedPcb, projectedSource] =
        AltiumSchematicCoordinateProjection.project(
            [
                {
                    type: 'schematic_arc',
                    schematic_arc_id: 'three_point_arc',
                    start: { x: 1, y: 2 },
                    mid: { x: 3, y: 4 },
                    end: { x: 5, y: 6 }
                },
                pcb,
                source
            ],
            10
        )

    assert.deepEqual(arc.start, { x: 1, y: 8 })
    assert.deepEqual(arc.mid, { x: 3, y: 6 })
    assert.deepEqual(arc.end, { x: 5, y: 4 })
    assert.equal(Object.hasOwn(arc, 'start_angle_degrees'), false)
    assert.equal(Object.hasOwn(arc, 'end_angle_degrees'), false)
    assert.equal(Object.hasOwn(arc, 'direction'), false)
    assert.equal(projectedPcb, pcb)
    assert.equal(projectedSource, source)
    assert.deepEqual(projectedPcb.center, { x: 1, y: 2 })
    assert.deepEqual(projectedSource.metadata, { y: 7 })
})

test('AltiumCircuitJsonProjection keeps PCB source traces while replacing schematic traces', () => {
    const schematicSourceTrace = {
        type: 'source_trace',
        source_trace_id: 'schematic_source_trace',
        connected_source_port_ids: [],
        connected_source_net_ids: []
    }
    const schematicTrace = {
        type: 'schematic_trace',
        schematic_trace_id: 'legacy_schematic_trace',
        source_trace_id: schematicSourceTrace.source_trace_id,
        junctions: [],
        edges: []
    }
    const pcbSourceTrace = {
        type: 'source_trace',
        source_trace_id: 'pcb_source_trace',
        connected_source_port_ids: [],
        connected_source_net_ids: []
    }
    const pcbTrace = {
        type: 'pcb_trace',
        pcb_trace_id: 'pcb_trace',
        source_trace_id: pcbSourceTrace.source_trace_id,
        route: []
    }
    const native = graphicRendererModel()
    native.schematic.lines = []
    const projected = AltiumCircuitJsonProjection.project(
        [schematicSourceTrace, schematicTrace, pcbSourceTrace, pcbTrace],
        native
    )

    assert.equal(projected.includes(schematicSourceTrace), false)
    assert.equal(projected.includes(schematicTrace), false)
    assert.equal(
        projected.find(
            (element) =>
                element.type === 'source_trace' &&
                element.source_trace_id === pcbSourceTrace.source_trace_id
        ),
        pcbSourceTrace
    )
    assert.equal(
        projected.find((element) => element.type === 'pcb_trace'),
        pcbTrace
    )
    assert.equal(pcbTrace.source_trace_id, pcbSourceTrace.source_trace_id)
})

test('common projection treats only explicit sourceType wire lines as electrical', () => {
    const native = graphicRendererModel()
    native.schematic.components = []
    native.schematic.nets = [{ name: 'SIG' }]
    native.schematic.lines = [
        {
            sourceType: 'graphic',
            netName: 'SIG',
            netIndex: 0,
            x1: 10,
            y1: 10,
            x2: 20,
            y2: 10
        },
        {
            sourceType: 'WIRE',
            netName: 'SIG',
            netIndex: 0,
            x1: 20,
            y1: 10,
            x2: 30,
            y2: 10
        }
    ]
    const projected = AltiumCircuitJsonProjection.project(
        CircuitJsonModelAdapter.fromRendererModel(native),
        native
    )
    const traces = projected.filter(
        (element) => element.type === 'schematic_trace'
    )
    const sourceTraces = projected.filter(
        (element) => element.type === 'source_trace'
    )

    assert.equal(
        projected.filter((element) => element.type === 'schematic_line').length,
        2
    )
    assert.equal(traces.length, 1)
    assert.equal(sourceTraces.length, 1)
    assert.equal(traces[0].source_trace_id, sourceTraces[0].source_trace_id)
    assert.deepEqual(traces[0].edges, [
        {
            from: { x: 20, y: 110 },
            to: { x: 30, y: 110 }
        }
    ])
})

test('AltiumCircuitJsonProjection preserves schematic graphics through the common contract', () => {
    const firstNative = graphicRendererModel()
    const secondNative = graphicRendererModel()
    const firstProjection = AltiumCircuitJsonProjection.project(
        CircuitJsonModelAdapter.fromRendererModel(firstNative),
        firstNative
    )
    const secondProjection = AltiumCircuitJsonProjection.project(
        CircuitJsonModelAdapter.fromRendererModel(secondNative),
        secondNative
    )
    const component = first(firstProjection, 'schematic_component')
    const rootSheet = first(firstProjection, 'schematic_sheet')
    const line = first(firstProjection, 'schematic_line')
    const rectangle = first(firstProjection, 'schematic_rect')
    const circle = first(firstProjection, 'schematic_circle')
    const arc = first(firstProjection, 'schematic_arc')
    const paths = firstProjection.filter(
        (element) => element.type === 'schematic_path'
    )
    const pie = paths.find((path) =>
        String(path.schematic_path_id).includes('_pie_')
    )

    assert.deepEqual(component.center, { x: 30, y: 90 })
    assert.equal(component.rotation, -90)
    assert.equal(component.show_label, false)
    assert.equal(rootSheet.width, 200)
    assert.equal(rootSheet.height, 120)
    assert.equal(line.color, '#112233')
    assert.deepEqual(
        { x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 },
        { x1: 25, y1: 90, x2: 35, y2: 90 }
    )
    assert.equal(line.stroke_width, 0.3)
    assert.equal(line.is_dashed, true)
    assert.deepEqual(line.stroke_dasharray, [8, 5, 1.5, 5])
    assert.equal(line.stroke_linecap, 'round')
    assert.equal(line.schematic_component_id, component.schematic_component_id)
    assert.deepEqual(rectangle.center, { x: 30, y: 90 })
    assert.equal(rectangle.color, '#223344')
    assert.equal(rectangle.fill_color, '#ddeeff')
    assert.equal(rectangle.is_filled, true)
    assert.equal(rectangle.is_dashed, true)
    assert.deepEqual(rectangle.stroke_dasharray, [8, 5])
    assert.equal(rectangle.stroke_linecap, 'round')
    assert.equal(
        rectangle.schematic_component_id,
        component.schematic_component_id
    )
    assert.deepEqual(circle.center, { x: 60, y: 110 })
    assert.equal(circle.radius, 3)
    assert.deepEqual(arc.center, { x: 80, y: 110 })
    assert.equal(arc.radius, 5)
    assert.equal(arc.start_angle_degrees, 0)
    assert.equal(arc.end_angle_degrees, -90)
    assert.equal(arc.direction, 'counterclockwise')

    const roundedRectangle = paths.find(
        (path) => path.points.length > 20 && path.is_filled === true
    )
    const unequalEllipse = paths.find(
        (path) => path.points.length === 48 && path.points[0]?.x === 74
    )
    const ellipticalArc = paths.find(
        (path) => path.points.length === 25 && path.points[0]?.x === 95
    )
    const bezier = paths.find(
        (path) => path.points.length === 25 && path.points[0]?.x === 0
    )
    const polygon = paths.find((path) => path.points.length === 3)

    assert.ok(roundedRectangle)
    assert.ok(pie)
    assert.equal(pie.is_filled, true)
    assert.equal(pie.fill_color, '#ccbbaa')
    assert.deepEqual(pie.points[0], { x: 100, y: 100 })
    assert.deepEqual(pie.points[1], { x: 105, y: 100 })
    assert.deepEqual(pie.points.at(-1), { x: 95, y: 100 })
    assert.ok(unequalEllipse)
    assert.deepEqual(unequalEllipse.points[0], { x: 74, y: 110 })
    assert.ok(ellipticalArc)
    assert.deepEqual(ellipticalArc.points.at(-1), { x: 85, y: 110 })
    assert.ok(bezier)
    assert.deepEqual(bezier.points.at(-1), { x: 6, y: 100 })
    assert.deepEqual(polygon.points, [
        { x: 10, y: 100 },
        { x: 16, y: 100 },
        { x: 13, y: 94 }
    ])
    assert.equal(polygon.stroke_color, '#99aabb')
    assert.equal(polygon.fill_color, '#8899aa')
    assert.equal(polygon.is_filled, true)

    const frameRectangles = firstProjection.filter(
        (element) =>
            element.type === 'schematic_rect' &&
            element.center.x === 35 &&
            element.center.y === 75
    )
    const frameTexts = firstProjection.filter(
        (element) =>
            element.type === 'schematic_text' && element.text === 'BOXED NOTE'
    )
    assert.equal(frameRectangles.length, 1)
    assert.equal(frameTexts.length, 1)
    assert.deepEqual(frameTexts[0].position, { x: 22, y: 72 })
    assert.equal(frameTexts[0].rotation, -90)
    assert.equal(frameTexts[0].anchor, 'top_left')

    const sheetSymbols = firstProjection.filter(
        (element) => element.type === 'schematic_sheet_symbol'
    )
    const sheet = sheetSymbols[0]
    const port = firstProjection.find(
        (element) =>
            element.type === 'schematic_port' &&
            element.display_pin_label === 'IN'
    )
    assert.ok(port)
    assert.equal(sheetSymbols.length, 2)
    assert.equal(sheet.name, 'Child')
    assert.equal(sheet.source_file_name, 'child.SchDoc')
    assert.deepEqual(sheet.center, { x: 120, y: 50 })
    assert.equal(sheet.width, 40)
    assert.equal(sheet.height, 20)
    assert.equal(
        port.schematic_sheet_symbol_id,
        sheet.schematic_sheet_symbol_id
    )
    assert.equal(port.side_of_component, 'left')
    assert.equal(port.facing_direction, 'left')
    assert.deepEqual(port.center, { x: 100, y: 50 })

    assert.deepEqual(
        firstProjection
            .filter((element) =>
                /schematic_(?:rect|circle|arc|path)_id/u.test(
                    Object.keys(element).join(',')
                )
            )
            .map(
                (element) =>
                    Object.entries(element).find(([key]) =>
                        key.endsWith('_id')
                    )?.[1]
            ),
        secondProjection
            .filter((element) =>
                /schematic_(?:rect|circle|arc|path)_id/u.test(
                    Object.keys(element).join(',')
                )
            )
            .map(
                (element) =>
                    Object.entries(element).find(([key]) =>
                        key.endsWith('_id')
                    )?.[1]
            )
    )
})

test('common Parser projects native Altium shape ownership and document graphics', () => {
    const source = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=220|CustomY=160|FontIdCount=1|Size1=10|FontName1=Arial',
        '|RECORD=1|IndexInSheet=100|Location.X=30|Location.Y=30|LibReference=IC|UniqueID=component-a',
        '|RECORD=41|OwnerIndex=700|Location.X=30|Location.Y=30|Name=Designator|Text=U1',
        '|RECORD=14|OwnerIndex=700|OwnerPartId=1|IndexInSheet=1|Location.X=25|Location.Y=26|Corner.X=35|Corner.Y=34|LineWidth=1|LineStyle=1|Color=3351057|AreaColor=13426158|IsSolid=T',
        '|RECORD=8|IndexInSheet=2|Location.X=60|Location.Y=20|Radius=4|SecondaryRadius=2|LineWidth=1|Color=5596791|AreaColor=13421772|IsSolid=T',
        '|RECORD=11|IndexInSheet=3|Location.X=80|Location.Y=20|Radius=5|SecondaryRadius=3|StartAngle=0|EndAngle=180|LineWidth=1|Color=6715272',
        '|RECORD=5|IndexInSheet=4|LineWidth=1|LineStyle=1|Color=7833753|LocationCount=4|X1=0|Y1=60|X2=2|Y2=56|X3=4|Y3=64|X4=6|Y4=60',
        '|RECORD=7|IndexInSheet=5|LineWidth=1|Color=8952234|AreaColor=10070715|IsSolid=T|LocationCount=3|X1=10|Y1=60|X2=16|Y2=60|X3=13|Y3=66',
        '|RECORD=28|IndexInSheet=6|Location.X=20|Location.Y=100|Corner.X=70|Corner.Y=80|Text=NOTE|TextMargin=2|FontID=1|TextColor=1193046|Color=6636321|AreaColor=16773290|IsSolid=T|ShowBorder=T',
        '|RECORD=15|IndexInSheet=7|Location.X=100|Location.Y=120|XSize=40|YSize=20|Name=Child|FileName=child.SchDoc|UniqueId=sheet-a',
        '|RECORD=16|IndexInSheet=8|OwnerIndex=7|Name=IN|Side=0|DistanceFromTop=1|IOType=2',
        '|RECORD=15|IndexInSheet=9|Location.X=150|Location.Y=120|XSize=30|YSize=20|Name=Child B|FileName=child-b.SchDoc|UniqueId=sheet-b',
        '|RECORD=16|IndexInSheet=10|OwnerIndex=9|Name=OUT|Side=0|DistanceFromTop=1|IOType=1',
        '|RECORD=27|IndexInSheet=11|LineWidth=1|Color=128|LocationCount=2|X1=10|Y1=20|X2=20|Y2=20'
    ].join('')
    const document = Parser.parse({
        fileName: 'native-graphics.SchDoc',
        data: source
    })
    const component = first(document.model, 'schematic_component')
    const ownedRectangle = document.model.find(
        (element) =>
            element.type === 'schematic_rect' &&
            element.schematic_component_id === component.schematic_component_id
    )
    const pathTypes = document.model.filter(
        (element) => element.type === 'schematic_path'
    )

    assert.ok(ownedRectangle)
    assert.equal(ownedRectangle.color, '#112233')
    assert.equal(ownedRectangle.fill_color, '#eeddcc')
    assert.equal(ownedRectangle.is_dashed, true)
    assert.equal(pathTypes.length >= 4, true)
    assert.equal(
        document.model.filter(
            (element) =>
                element.type === 'schematic_text' && element.text === 'NOTE'
        ).length,
        1
    )
    assert.equal(
        document.model.filter(
            (element) => element.type === 'schematic_sheet_symbol'
        ).length,
        2
    )
    assert.equal(
        document.model.filter((element) => element.type === 'schematic_sheet')
            .length,
        1
    )
    assert.equal(
        document.model.filter((element) => element.type === 'schematic_trace')
            .length,
        1
    )
    assert.equal(
        document.model.find(
            (element) =>
                element.type === 'schematic_sheet_symbol' &&
                element.name === 'Child'
        )?.source_file_name,
        'child.SchDoc'
    )
})

test('AltiumDocumentBuilder owns embedded schematic image bytes as canonical assets', () => {
    const native = graphicRendererModel()
    native.schematic.images = [
        {
            x: 20,
            y: 30,
            cornerX: 80,
            cornerY: 70,
            fileName: 'art/logo.png',
            embedded: true,
            keepAspect: true,
            mimeType: 'image/png',
            dataBase64: 'AQID',
            rotation: 30,
            renderOrder: 15,
            diagnosticState: 'embedded'
        }
    ]
    const model = AltiumCircuitJsonProjection.project(
        CircuitJsonModelAdapter.fromRendererModel(native),
        native
    ).filter(
        (element) => !String(element?.type || '').startsWith('altium_toolkit_')
    )
    const document = AltiumDocumentBuilder.build(
        {
            input: {
                fileName: 'embedded-graphic.SchDoc',
                data: new ArrayBuffer(0),
                assets: []
            },
            sourceReference: {},
            options: {
                decodeAssets: 'full',
                extensions: 'none',
                preserveRaw: false,
                retainSource: 'none'
            }
        },
        { native, model, nativeSidecarCount: 0 }
    )
    const image = first(document.model, 'schematic_image')
    const asset = document.assets.find(
        (candidate) => candidate.id === image.asset_id
    )

    assert.deepEqual(image.center, { x: 50, y: 70 })
    assert.deepEqual(image.size, { width: 60, height: 40 })
    assert.equal(image.source_path, 'art/logo.png')
    assert.equal(image.source_name, 'logo.png')
    assert.equal(image.preserve_aspect_ratio, true)
    assert.equal(image.rotation, -30)
    assert.equal(image.render_order, 15)
    assert.equal(Object.hasOwn(image, 'data'), false)
    assert.equal(Object.hasOwn(image, 'mime_type'), false)
    assert.ok(asset)
    assert.equal(asset.kind, 'schematic-image')
    assert.equal(asset.name, 'logo.png')
    assert.equal(asset.mediaType, 'image/png')
    assert.deepEqual([...asset.data], [1, 2, 3])
    assert.match(
        SchematicSvgRenderer.render(document),
        /href="data:image\/png;base64,AQID"/u
    )
})

test('common Parser source-describes unresolved external schematic images', () => {
    const source =
        '|HEADER=Schematic Document' +
        '|RECORD=31|CustomX=160|CustomY=120' +
        '|RECORD=30|IndexInSheet=2|Location.X=20|Location.Y=30' +
        '|Corner.X=80|Corner.Y=70|EmbedImage=F|KeepAspect=T' +
        '|FileName=art/external-logo.png'
    const document = Parser.parse(
        {
            fileName: 'external-image.SchDoc',
            data: source
        },
        { decodeAssets: 'full' }
    )
    const image = first(document.model, 'schematic_image')
    const asset = document.assets.find(
        (candidate) => candidate.id === image.asset_id
    )

    assert.equal(image.source_path, 'art/external-logo.png')
    assert.equal(image.source_name, 'external-logo.png')
    assert.equal(image.preserve_aspect_ratio, true)
    assert.ok(asset)
    assert.equal(asset.data, null)
    assert.equal(asset.mediaType, 'image/png')
    assert.equal(
        document.diagnostics.some(
            (diagnostic) =>
                diagnostic.code === 'altium.schematic.image.asset-unresolved'
        ),
        true
    )
    assert.equal(
        SchematicSvgRenderer.render(document).includes('<image'),
        false
    )
})
