import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumLibraryBatchExporter } from '../../src/core/altium/AltiumLibraryBatchExporter.mjs'
import { AltiumPcbLibExporter } from '../../src/core/altium/AltiumPcbLibExporter.mjs'
import { AltiumSchLibExporter } from '../../src/core/altium/AltiumSchLibExporter.mjs'
import { OleCompoundDocument } from '../../src/core/ole/OleCompoundDocument.mjs'
import { PcbLibStreamExtractor } from '../../src/core/altium/PcbLibStreamExtractor.mjs'
import { PcbLibModelParser } from '../../src/core/altium/PcbLibModelParser.mjs'
import { SchLibModelParser } from '../../src/core/altium/SchLibModelParser.mjs'
import { SchLibStreamExtractor } from '../../src/core/altium/SchLibStreamExtractor.mjs'
import { SourceBundleExporter } from '../../src/core/altium/SourceBundleExporter.mjs'
import { SourceComponentBundleNormalizer } from '../../src/core/altium/SourceComponentBundleNormalizer.mjs'
import { SourceComponentClient } from '../../src/core/altium/SourceComponentClient.mjs'

/**
 * Builds a deterministic fake provider component response.
 * @param {string} [id] Component identifier.
 * @returns {object}
 */
function createRawComponent(id = 'source-widget') {
    return {
        id,
        name: 'Source Widget',
        data: {
            metadata: {
                description: 'Synthetic source component',
                package: 'FAKE_WIDGET_0603'
            },
            symbol: {
                name: 'FAKE_WIDGET_SYMBOL',
                pins: [
                    { name: 'A', number: '1' },
                    { name: 'B', number: '2' }
                ],
                primitives: [{ type: 'rectangle', x: 0, y: 0 }]
            },
            footprint: {
                name: 'FAKE_WIDGET_0603',
                pads: [
                    { name: '1', x: -20, y: 0 },
                    { name: '2', x: 20, y: 0 }
                ],
                tracks: [{ layer: 'TopOverlay', width: 4 }]
            },
            models: [
                {
                    name: 'fake-widget.step',
                    format: 'step',
                    text: 'ISO-10303-21;\nEND-ISO-10303-21;'
                }
            ]
        }
    }
}

/**
 * Builds a fake component with visible library geometry.
 * @returns {object}
 */
function createGeometryComponent() {
    return {
        id: 'geometry-source',
        name: 'Geometry Source',
        symbol: {
            name: 'FAKE_GEOMETRY_SYMBOL',
            pins: [
                {
                    number: '1',
                    name: 'IN',
                    x: 10,
                    y: 20,
                    length: 30,
                    electrical: 'input'
                },
                {
                    number: '2',
                    name: 'OUT',
                    x: 90,
                    y: 20,
                    length: 30,
                    electrical: 'output'
                }
            ],
            primitives: [
                {
                    type: 'rectangle',
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 40
                }
            ]
        },
        footprint: {
            name: 'FAKE_GEOMETRY_FOOTPRINT',
            pads: [
                {
                    number: '1',
                    x: -25,
                    y: 0,
                    sizeTopX: 20,
                    sizeTopY: 30,
                    layerId: 1
                },
                {
                    number: '2',
                    x: 25,
                    y: 0,
                    sizeTopX: 20,
                    sizeTopY: 30,
                    layerId: 1
                }
            ],
            tracks: [
                {
                    x1: -40,
                    y1: -20,
                    x2: 40,
                    y2: -20,
                    width: 4,
                    layerId: 21
                }
            ],
            arcs: [
                {
                    x: 0,
                    y: 0,
                    radius: 15,
                    startAngle: 0,
                    endAngle: 180,
                    width: 3,
                    layerId: 21
                }
            ],
            fills: [
                {
                    x1: -10,
                    y1: 10,
                    x2: 10,
                    y2: 20,
                    layerId: 1
                }
            ],
            texts: [
                {
                    text: 'REF',
                    x: 0,
                    y: -35,
                    height: 12,
                    layerId: 21
                }
            ]
        }
    }
}

/**
 * Converts one byte view into an exact ArrayBuffer slice.
 * @param {Uint8Array} bytes Bytes to convert.
 * @returns {ArrayBuffer}
 */
function toArrayBuffer(bytes) {
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    )
}

/**
 * Opens a generated OLE document as a stream map.
 * @param {Uint8Array} bytes Generated bytes.
 * @returns {Map<string, Uint8Array>}
 */
function openStreams(bytes) {
    const document = OleCompoundDocument.fromArrayBuffer(toArrayBuffer(bytes))
    return new Map(
        document.listStreams().map((name) => [name, document.getStream(name)])
    )
}

test('SourceComponentBundleNormalizer creates deterministic bundles', () => {
    const bundle =
        SourceComponentBundleNormalizer.normalize(createRawComponent())

    assert.equal(bundle.id, 'source-widget')
    assert.equal(bundle.name, 'Source Widget')
    assert.equal(bundle.symbol.name, 'FAKE_WIDGET_SYMBOL')
    assert.equal(bundle.footprint.name, 'FAKE_WIDGET_0603')
    assert.equal(bundle.models[0].name, 'fake-widget.step')
    assert.equal(bundle.models[0].format, 'step')
    assert.equal(bundle.metadata.description, 'Synthetic source component')
    assert.deepEqual(bundle.diagnostics, [])
})

test('SourceBundleExporter emits source JSON and model assets', () => {
    const bundle =
        SourceComponentBundleNormalizer.normalize(createRawComponent())
    const exportResult = SourceBundleExporter.export(bundle)
    const paths = exportResult.entries.map((entry) => entry.path)

    assert.deepEqual(paths, [
        'manifest.json',
        'models/fake-widget.step',
        'source/source.json'
    ])
    assert.equal(exportResult.manifest.component.id, 'source-widget')
    assert.match(
        new TextDecoder().decode(exportResult.entries[2].bytes),
        /FAKE_WIDGET_SYMBOL/
    )
})

test('SourceComponentClient uses injected fetch with retry', async () => {
    const calls = []
    const fetcher = async (url) => {
        calls.push(String(url))
        if (calls.length === 1) {
            return {
                ok: false,
                status: 503,
                text: async () => 'busy'
            }
        }
        return {
            ok: true,
            status: 200,
            json: async () => ({ results: [createRawComponent('found-a')] })
        }
    }
    const client = new SourceComponentClient({
        fetcher,
        baseUrl: 'https://components.invalid',
        retryCount: 1
    })

    const results = await client.searchComponents('widget 0603')

    assert.equal(results[0].id, 'found-a')
    assert.equal(calls.length, 2)
    assert.match(calls[0], /q=widget\+0603/)
})

test('SourceComponentClient requires an injected fetcher', async () => {
    const client = new SourceComponentClient()

    await assert.rejects(
        () => client.searchComponents('widget'),
        /fetcher is required/
    )
})

test('AltiumSchLibExporter writes readable schematic library streams', () => {
    const bundle =
        SourceComponentBundleNormalizer.normalize(createRawComponent())
    const streams = openStreams(AltiumSchLibExporter.export([bundle]))

    assert.deepEqual([...streams.keys()].sort(), [
        'Components/FAKE_WIDGET_SYMBOL/Data',
        'Library/Data'
    ])
    assert.match(
        new TextDecoder().decode(streams.get('Library/Data')),
        /FAKE_WIDGET_SYMBOL/
    )
    assert.match(
        new TextDecoder().decode(
            streams.get('Components/FAKE_WIDGET_SYMBOL/Data')
        ),
        /PinCount=2/
    )
})

test('AltiumPcbLibExporter writes readable footprint library and model streams', () => {
    const bundle =
        SourceComponentBundleNormalizer.normalize(createRawComponent())
    const streams = openStreams(AltiumPcbLibExporter.export([bundle]))
    const extraction = PcbLibStreamExtractor.extractFromStreams(streams)

    assert.equal(extraction.footprints[0].name, 'FAKE_WIDGET_0603')
    assert.equal(extraction.footprints[0].declaredPrimitiveCount, 3)
    assert.equal(extraction.footprints[0].pads.length, 2)
    assert.equal(extraction.footprints[0].tracks.length, 1)
    assert.equal(extraction.embeddedModels.models[0].name, 'fake-widget.step')
    assert.match(
        extraction.embeddedModels.models[0].payloadText,
        /ISO-10303-21/
    )
})

test('AltiumPcbLibExporter places embedded models as component bodies', () => {
    const rawComponent = createRawComponent()
    rawComponent.data.footprint.component = { rotation: 270 }
    rawComponent.data.models[0].generated = true
    const streams = openStreams(AltiumPcbLibExporter.export([rawComponent]))
    const extraction = PcbLibStreamExtractor.extractFromStreams(streams)
    const body = extraction.embeddedModels.componentBodies[0]

    assert.equal(body.modelId, 'model-0-0')
    assert.equal(body.embedded, true)
    assert.equal(body.name, 'fake-widget.step')
    assert.deepEqual(body.modelRotationDeg, { x: -90, y: 0, z: 90 })
})

test('Altium library exporters preserve selected symbol and footprint geometry', () => {
    const bundle = SourceComponentBundleNormalizer.normalize(
        createGeometryComponent()
    )
    const schModel = SchLibModelParser.parse(
        'geometry.SchLib',
        SchLibStreamExtractor.extractFromStreams(
            openStreams(AltiumSchLibExporter.export([bundle]))
        )
    )
    const pcbModel = PcbLibModelParser.parse(
        'geometry.PcbLib',
        PcbLibStreamExtractor.extractFromStreams(
            openStreams(AltiumPcbLibExporter.export([bundle]))
        )
    )
    const symbol = schModel.schematicLibrary.symbols[0]
    const footprint = pcbModel.pcbLibrary.footprints[0]

    assert.equal(symbol.declaredPinCount, 2)
    assert.equal(symbol.declaredPrimitiveCount, 1)
    assert.equal(symbol.pins.length, 2)
    assert.equal(symbol.primitives.length, 1)
    assert.equal(footprint.declaredPrimitiveCount, 6)
    assert.equal(footprint.pads.length, 2)
    assert.equal(footprint.tracks.length, 1)
    assert.equal(footprint.arcs.length, 1)
    assert.equal(footprint.fills.length, 1)
    assert.equal(footprint.texts.length, 1)
})

test('AltiumLibraryBatchExporter supports merged output, append skip, and progress', async () => {
    const progress = []
    const fetchedIds = []
    const client = {
        /**
         * Fetches a fake bundle for one source id.
         * @param {string} id Component id.
         * @returns {Promise<object>}
         */
        async fetchComponentBundle(id) {
            fetchedIds.push(id)
            return SourceComponentBundleNormalizer.normalize(
                createRawComponent(id)
            )
        }
    }
    const exporter = new AltiumLibraryBatchExporter({ client })
    const result = await exporter.exportIds(['part-a', 'part-b'], {
        appendManifest: { completedIds: ['part-b'] },
        includeSourceBundle: true,
        includeSchLib: true,
        includePcbLib: true,
        merged: true,
        onProgress: (event) => progress.push(event)
    })

    assert.deepEqual(fetchedIds, ['part-a'])
    assert.deepEqual(result.checkpoint.completedIds, ['part-b', 'part-a'])
    assert(
        result.entries.some((entry) => entry.path === 'part-a/manifest.json')
    )
    assert(
        result.entries.some((entry) => entry.path === 'merged/library.SchLib')
    )
    assert(
        result.entries.some((entry) => entry.path === 'merged/library.PcbLib')
    )
    assert.deepEqual(
        progress.map((event) => event.status),
        ['exported', 'skipped']
    )
})
