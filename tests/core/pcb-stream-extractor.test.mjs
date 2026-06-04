// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbStreamExtractor } from '../../src/core/altium/PcbStreamExtractor.mjs'
import { PcbSidecarTestFactory } from './PcbSidecarTestFactory.mjs'

/**
 * Builds synthetic PCB stream payloads for stream-scoped extraction tests.
 */
class PcbStreamTestFactory {
    /**
     * Creates one printable board stream.
     * @returns {Uint8Array}
     */
    static createBoardStream() {
        return new TextEncoder().encode(
            [
                '|HEADER=PCB 6.0 Binary File',
                '|KIND0=0|VX0=0mil|VY0=0mil|CX0=0mil|CY0=0mil|SA0=0|EA0=0|R0=0mil|KIND1=0|VX1=1000mil|VY1=0mil|CX1=0mil|CY1=0mil|SA1=0|EA1=0|R1=0mil|KIND2=0|VX2=1000mil|VY2=500mil|CX2=0mil|CY2=0mil|SA2=0|EA2=0|R2=0mil|KIND3=0|VX3=0mil|VY3=500mil|CX3=0mil|CY3=0mil|SA3=0|EA3=0|R3=0mil',
                '|RECORD=Board|V9_STACK_LAYER1_NAME=Top Layer|V9_STACK_LAYER1_LAYERID=1|V9_STACK_LAYER2_NAME=Bottom Layer|V9_STACK_LAYER2_LAYERID=2'
            ].join('')
        )
    }

    /**
     * Creates one printable component stream.
     * @returns {Uint8Array}
     */
    static createComponentStream() {
        return new TextEncoder().encode(
            '|LAYER=TOP|X=250mil|Y=300mil|PATTERN=0603|ROTATION=0|HEIGHT=12mil|SOURCEDESIGNATOR=R1|SOURCELIBREFERENCE=RES/FAKE/10K|SOURCEDESCRIPTION=Drift resistor'
        )
    }

    /**
     * Creates one printable stream with many small records.
     * @param {number} recordCount Number of records to write.
     * @returns {Uint8Array}
     */
    static createLargePrintableStream(recordCount) {
        return new TextEncoder().encode(
            Array.from(
                { length: recordCount },
                (_value, index) =>
                    '|RECORD=Track|X=' + index + 'mil|Y=0mil|LAYER=TOP'
            ).join('')
        )
    }

    /**
     * Creates one printable polygon stream.
     * @returns {Uint8Array}
     */
    static createPolygonStream() {
        return new TextEncoder().encode(
            '|SELECTION=FALSE|LAYER=TOP|POLYGONTYPE=Polygon|KIND0=0|VX0=100mil|VY0=100mil|CX0=0mil|CY0=0mil|SA0=0|EA0=0|R0=0mil|KIND1=0|VX1=200mil|VY1=100mil|CX1=0mil|CY1=0mil|SA1=0|EA1=0|R1=0mil|KIND2=0|VX2=200mil|VY2=200mil|CX2=0mil|CY2=0mil|SA2=0|EA2=0|R2=0mil|KIND3=0|VX3=100mil|VY3=200mil|CX3=0mil|CY3=0mil|SA3=0|EA3=0|R3=0mil'
        )
    }

    /**
     * Creates one synthetic stream map with printable and binary payloads.
     * @returns {Map<string, Uint8Array>}
     */
    static createStreamMap() {
        const streams = new Map()
        const arcStream = PcbStreamTestFactory.#createArcStream()
        const trackStream = PcbStreamTestFactory.#createTrackStream()
        const viaStream = PcbStreamTestFactory.#createViaStream()
        const fillStream = PcbStreamTestFactory.#createFillStream()
        const padStream = PcbStreamTestFactory.#createPadStream()
        const regionStream = PcbStreamTestFactory.#createRegionStream()

        streams.set('Board6/Data', PcbStreamTestFactory.createBoardStream())
        streams.set(
            'Components6/Data',
            PcbStreamTestFactory.createComponentStream()
        )
        streams.set(
            'Polygons6/Data',
            PcbStreamTestFactory.createPolygonStream()
        )
        streams.set('Arcs6/Header', arcStream.headerBytes)
        streams.set('Arcs6/Data', arcStream.dataBytes)
        streams.set('Tracks6/Header', trackStream.headerBytes)
        streams.set('Tracks6/Data', trackStream.dataBytes)
        streams.set('Vias6/Header', viaStream.headerBytes)
        streams.set('Vias6/Data', viaStream.dataBytes)
        streams.set('Fills6/Header', fillStream.headerBytes)
        streams.set('Fills6/Data', fillStream.dataBytes)
        streams.set('Pads6/Header', padStream.headerBytes)
        streams.set('Pads6/Data', padStream.dataBytes)
        streams.set('Regions6/Header', regionStream.headerBytes)
        streams.set('Regions6/Data', regionStream.dataBytes)

        return streams
    }

    /**
     * Creates a stream map with one via linked to one via-protection sidecar.
     * @returns {Map<string, Uint8Array>}
     */
    static createStreamMapWithViaStructure() {
        const streams = PcbStreamTestFactory.createStreamMap()

        streams.set(
            'ViaStructures/Data',
            PcbStreamTestFactory.#createLengthPrefixedParameterRecords([
                '|VIASTRUCTUREINDEX=0|STRUCTURETYPE=4|FEATURETYPE0=plugged|FEATURESIDE0=top|FEATUREMATERIAL0=nonconductive epoxy|FEATURETYPE1=capped|FEATURESIDE1=bottom|FEATUREMATERIAL1=copper'
            ])
        )
        streams.set(
            'ViaStructureManager/Data',
            PcbStreamTestFactory.#createLengthPrefixedParameterRecords([
                '|PRIMITIVEINDEX=0|VIASTRUCTUREINDEX=0'
            ])
        )

        return streams
    }

    /**
     * Creates one PrimitiveParameters/Data stream with component parameters.
     * @returns {Uint8Array}
     */
    static createPrimitiveParameterStream() {
        return PcbStreamTestFactory.#createLengthPrefixedParameterRecords([
            '|PRIMITIVEID=UID-C1|ID=Component#0|APPURTENANCE=System|VARIANTGUID=System|COUNT=0',
            '|PRIMITIVEID=UID-C1|ID=Component#0|COUNT=2',
            '|NAME=Manufacturer|VALUE=Acme',
            '|NAME=MPN|VALUE=XYZ-1'
        ])
    }

    /**
     * Creates one WideStrings6/Data stream.
     * @returns {Uint8Array}
     */
    static createWideStringStream() {
        const textBytes = new Uint8Array(Buffer.from('J1_CH2\0', 'utf16le'))
        const dataBytes = new Uint8Array(8 + textBytes.byteLength)
        const dataView = new DataView(dataBytes.buffer)

        dataView.setUint32(0, 6, true)
        dataView.setUint32(4, textBytes.byteLength, true)
        dataBytes.set(textBytes, 8)

        return dataBytes
    }

    /**
     * Creates one Texts6 stream pair with a WideStrings6-backed designator.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createWideStringTextStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const payloadLength = 123
        const dataBytes = new Uint8Array(5 + payloadLength)
        const dataView = new DataView(dataBytes.buffer)
        const payloadOffset = 5

        headerView.setUint32(0, 1, true)
        dataView.setUint8(0, 5)
        dataView.setUint32(1, payloadLength, true)
        dataView.setUint8(payloadOffset, 33)
        dataView.setInt16(payloadOffset + 7, 2, true)
        PcbStreamTestFactory.#writeMil(dataView, payloadOffset + 13, 120)
        PcbStreamTestFactory.#writeMil(dataView, payloadOffset + 17, 140)
        PcbStreamTestFactory.#writeMil(dataView, payloadOffset + 21, 10)
        dataView.setUint16(payloadOffset + 25, 0, true)
        dataView.setUint8(payloadOffset + 41, 1)
        dataView.setUint8(payloadOffset + 43, 1)
        dataView.setUint32(payloadOffset + 115, 6, true)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one synthetic arc stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static #createArcStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(65)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)
        const payloadOffset = 5

        headerView.setUint32(0, 1, true)
        dataView.setUint8(0, 1)
        dataView.setUint32(1, 60, true)
        dataView.setUint8(payloadOffset, 33)
        dataView.setUint16(payloadOffset + 3, 16, true)
        dataView.setUint16(payloadOffset + 5, 26, true)
        dataView.setUint16(payloadOffset + 7, 6, true)
        PcbStreamTestFactory.#writeMil(dataView, payloadOffset + 13, 420)
        PcbStreamTestFactory.#writeMil(dataView, payloadOffset + 17, 360)
        PcbStreamTestFactory.#writeMil(dataView, payloadOffset + 21, 48)
        dataView.setFloat64(payloadOffset + 25, 90, true)
        dataView.setFloat64(payloadOffset + 33, 180, true)
        PcbStreamTestFactory.#writeMil(dataView, payloadOffset + 41, 6)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one synthetic track stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static #createTrackStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(54)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)
        const payloadOffset = 5

        headerView.setUint32(0, 1, true)
        dataView.setUint8(0, 4)
        dataView.setUint32(1, 49, true)
        dataView.setUint8(payloadOffset, 1)
        dataView.setUint16(payloadOffset + 3, 13, true)
        dataView.setUint16(payloadOffset + 5, 23, true)
        dataView.setUint16(payloadOffset + 7, 3, true)
        PcbStreamTestFactory.#writeMil(dataView, payloadOffset + 13, 1000)
        PcbStreamTestFactory.#writeMil(dataView, payloadOffset + 17, 2000)
        PcbStreamTestFactory.#writeMil(dataView, payloadOffset + 21, 1500)
        PcbStreamTestFactory.#writeMil(dataView, payloadOffset + 25, 2000)
        PcbStreamTestFactory.#writeMil(dataView, payloadOffset + 29, 8)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one synthetic via stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static #createViaStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(326)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)

        headerView.setUint32(0, 1, true)
        dataView.setUint8(5, 74)
        dataView.setUint16(8, 14, true)
        dataView.setUint16(10, 24, true)
        dataView.setUint16(12, 4, true)
        PcbStreamTestFactory.#writeMil(dataView, 18, 500)
        PcbStreamTestFactory.#writeMil(dataView, 22, 250)
        PcbStreamTestFactory.#writeMil(dataView, 26, 24)
        PcbStreamTestFactory.#writeMil(dataView, 30, 12)
        dataView.setUint8(34, 1)
        dataView.setUint8(35, 32)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one synthetic fill stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static #createFillStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(55)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)

        headerView.setUint32(0, 1, true)
        dataView.setUint16(8, 15, true)
        dataView.setUint16(10, 25, true)
        dataView.setUint16(12, 5, true)
        PcbStreamTestFactory.#writeMil(dataView, 18, 400)
        PcbStreamTestFactory.#writeMil(dataView, 22, 150)
        PcbStreamTestFactory.#writeMil(dataView, 26, 460)
        PcbStreamTestFactory.#writeMil(dataView, 30, 210)
        dataView.setUint16(46, 256, true)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one synthetic pad stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static #createPadStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const mainPayload = new Uint8Array(64)
        const payloadView = new DataView(mainPayload.buffer)

        headerView.setUint32(0, 1, true)
        payloadView.setUint8(0, 74)
        payloadView.setUint16(3, 17, true)
        payloadView.setUint16(5, 0xffff, true)
        payloadView.setUint16(7, 7, true)
        PcbStreamTestFactory.#writeMil(payloadView, 13, 320)
        PcbStreamTestFactory.#writeMil(payloadView, 17, 260)
        PcbStreamTestFactory.#writeMil(payloadView, 21, 180)
        PcbStreamTestFactory.#writeMil(payloadView, 25, 180)
        PcbStreamTestFactory.#writeMil(payloadView, 29, 180)
        PcbStreamTestFactory.#writeMil(payloadView, 33, 180)
        PcbStreamTestFactory.#writeMil(payloadView, 37, 180)
        PcbStreamTestFactory.#writeMil(payloadView, 41, 180)
        PcbStreamTestFactory.#writeMil(payloadView, 45, 100)
        payloadView.setUint8(49, 1)
        payloadView.setUint8(50, 1)
        payloadView.setUint8(51, 1)
        payloadView.setFloat64(52, 45, true)
        payloadView.setUint8(60, 1)

        return {
            headerBytes,
            dataBytes: PcbStreamTestFactory.#createLengthPrefixedRecord(2, [
                new Uint8Array(0),
                new Uint8Array(0),
                new Uint8Array(0),
                new Uint8Array(0),
                mainPayload,
                new Uint8Array(0)
            ])
        }
    }

    /**
     * Creates one synthetic region stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static #createRegionStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const properties = new TextEncoder().encode(
            'KIND=0|ISBOARDCUTOUT=FALSE|ISSHAPEBASED=FALSE'
        )
        const contentLength = 18 + 4 + properties.byteLength + 4 + 4 * 16
        const dataBytes = new Uint8Array(5 + contentLength)
        const dataView = new DataView(dataBytes.buffer)
        let offset = 0

        headerView.setUint32(0, 1, true)
        dataView.setUint8(offset, 11)
        offset += 1
        dataView.setUint32(offset, contentLength, true)
        offset += 4
        dataView.setUint8(offset, 1)
        offset += 1
        dataView.setUint8(offset, 4)
        offset += 1
        dataView.setUint8(offset, 0)
        offset += 1
        dataView.setUint16(offset, 18, true)
        offset += 2
        dataView.setUint16(offset, 28, true)
        offset += 2
        dataView.setUint16(offset, 8, true)
        offset += 2
        offset += 5
        dataView.setUint16(offset, 0, true)
        offset += 2
        offset += 2
        dataView.setUint32(offset, properties.byteLength, true)
        offset += 4
        dataBytes.set(properties, offset)
        offset += properties.byteLength
        dataView.setUint32(offset, 4, true)
        offset += 4
        for (const [x, y] of [
            [50, 60],
            [90, 60],
            [90, 120],
            [50, 120]
        ]) {
            dataView.setFloat64(offset, x * 10000, true)
            offset += 8
            dataView.setFloat64(offset, y * 10000, true)
            offset += 8
        }

        return { headerBytes, dataBytes }
    }

    /**
     * Writes one standard little-endian fixed-point mil value.
     * @param {DataView} dataView
     * @param {number} offset
     * @param {number} valueMil
     */
    static #writeMil(dataView, offset, valueMil) {
        dataView.setUint32(offset, Math.round(valueMil * 10000), true)
    }

    /**
     * Encodes one variable-length primitive record with length-prefixed
     * subrecords.
     * @param {number} objectId
     * @param {Uint8Array[]} subrecords
     * @returns {Uint8Array}
     */
    static #createLengthPrefixedRecord(objectId, subrecords) {
        const totalLength =
            1 +
            subrecords.reduce(
                (sum, subrecord) => sum + 4 + subrecord.byteLength,
                0
            )
        const dataBytes = new Uint8Array(totalLength)
        const dataView = new DataView(dataBytes.buffer)
        let offset = 0

        dataView.setUint8(offset, objectId)
        offset += 1

        for (const subrecord of subrecords) {
            dataView.setUint32(offset, subrecord.byteLength, true)
            offset += 4
            dataBytes.set(subrecord, offset)
            offset += subrecord.byteLength
        }

        return dataBytes
    }

    /**
     * Encodes length-prefixed primitive parameter records.
     * @param {string[]} records
     * @returns {Uint8Array}
     */
    static #createLengthPrefixedParameterRecords(records) {
        const encoder = new TextEncoder()
        const encodedRecords = records.map((record) => encoder.encode(record))
        const totalLength = encodedRecords.reduce(
            (sum, record) => sum + 4 + record.byteLength,
            0
        )
        const dataBytes = new Uint8Array(totalLength)
        const dataView = new DataView(dataBytes.buffer)
        let offset = 0

        for (const record of encodedRecords) {
            dataView.setUint32(offset, record.byteLength, true)
            offset += 4
            dataBytes.set(record, offset)
            offset += record.byteLength
        }

        return dataBytes
    }
}

/**
 * Verifies stream-aware extraction preserves printable PCB records and decodes
 * binary copper primitives from named streams.
 */
test('PcbStreamExtractor extracts printable and binary PCB streams', () => {
    const extracted = PcbStreamExtractor.extractFromStreams(
        PcbStreamTestFactory.createStreamMap()
    )

    assert.equal(extracted.records.length, 4)
    assert.deepEqual(extracted.streamNames, [
        'Arcs6/Data',
        'Board6/Data',
        'Components6/Data',
        'Fills6/Data',
        'Pads6/Data',
        'Polygons6/Data',
        'Regions6/Data',
        'Tracks6/Data',
        'Vias6/Data'
    ])
    assert.deepEqual(extracted.binaryPrimitives.tracks, [
        {
            x1: 1000,
            y1: 2000,
            x2: 1500,
            y2: 2000,
            width: 8,
            componentIndex: 3,
            netIndex: 13,
            polygonIndex: 23,
            layerCode: 1,
            layerId: 1
        }
    ])
    assert.deepEqual(extracted.binaryPrimitives.vias, [
        {
            x: 500,
            y: 250,
            diameter: 24,
            holeDiameter: 12,
            componentIndex: 4,
            netIndex: 14,
            polygonIndex: 24,
            layerCode: 74,
            layerId: 74,
            layerStartId: 1,
            layerEndId: 32
        }
    ])
    assert.deepEqual(extracted.binaryPrimitives.fills, [
        {
            x1: 400,
            y1: 150,
            x2: 460,
            y2: 210,
            componentIndex: 5,
            netIndex: 15,
            polygonIndex: 25,
            layerCode: 256,
            layerId: 0
        }
    ])
    assert.deepEqual(extracted.binaryPrimitives.arcs, [
        {
            x: 420,
            y: 360,
            radius: 48,
            startAngle: 90,
            endAngle: 180,
            width: 6,
            componentIndex: 6,
            netIndex: 16,
            polygonIndex: 26,
            layerCode: 33,
            layerId: 33
        }
    ])
    assert.deepEqual(extracted.binaryPrimitives.pads, [
        {
            x: 320,
            y: 260,
            sizeTopX: 180,
            sizeTopY: 180,
            sizeMidX: 180,
            sizeMidY: 180,
            sizeBottomX: 180,
            sizeBottomY: 180,
            holeDiameter: 100,
            shapeTop: 1,
            shapeMid: 1,
            shapeBottom: 1,
            shapeTopName: 'round',
            shapeMidName: 'round',
            shapeBottomName: 'round',
            padShapeNames: {
                top: 'round',
                middle: 'round',
                bottom: 'round'
            },
            rotation: 45,
            isPlated: true,
            holeShape: null,
            holeSlotLength: null,
            holeRotation: null,
            hasRoundedRect: false,
            roundedRectShapeTop: null,
            cornerRadiusTop: null,
            offsetTopX: 0,
            offsetTopY: 0,
            componentIndex: 7,
            netIndex: 17,
            polygonIndex: null,
            layerCode: 74,
            layerId: 74,
            legacyLayerId: 74,
            layerV7SaveId: null
        }
    ])
    assert.deepEqual(extracted.binaryPrimitives.regions, [
        {
            layerId: 1,
            layerCode: 1,
            netIndex: 18,
            polygonIndex: 28,
            componentIndex: 8,
            kind: 0,
            isKeepout: false,
            isBoardCutout: false,
            isShapeBased: false,
            points: [
                { x: 50, y: 60 },
                { x: 90, y: 60 },
                { x: 90, y: 120 },
                { x: 50, y: 120 }
            ],
            holes: [],
            properties: {
                KIND: '0',
                ISBOARDCUTOUT: 'FALSE',
                ISSHAPEBASED: 'FALSE'
            }
        }
    ])
    assert.deepEqual(extracted.embeddedModels, {
        models: [],
        componentBodies: [],
        integrity: {
            schema: 'altium-toolkit.pcb.embedded-model-integrity.a1',
            issues: []
        },
        diagnostics: []
    })
})

/**
 * Verifies binary sidecar streams are parsed explicitly instead of being
 * recovered as generic printable records.
 */
test('PcbStreamExtractor extracts primitive parameters and WideStrings6 text', () => {
    const streams = new Map()
    const textStream = PcbStreamTestFactory.createWideStringTextStream()

    streams.set(
        'PrimitiveParameters/Data',
        PcbStreamTestFactory.createPrimitiveParameterStream()
    )
    streams.set(
        'WideStrings6/Data',
        PcbStreamTestFactory.createWideStringStream()
    )
    streams.set('Texts6/Header', textStream.headerBytes)
    streams.set('Texts6/Data', textStream.dataBytes)

    const extracted = PcbStreamExtractor.extractFromStreams(streams)

    assert.equal(extracted.records.length, 0)
    assert.deepEqual(extracted.streamNames, [
        'PrimitiveParameters/Data',
        'Texts6/Data',
        'WideStrings6/Data'
    ])
    assert.deepEqual(extracted.primitiveParameters.byPrimitiveId['UID-C1'], {
        Manufacturer: 'Acme',
        MPN: 'XYZ-1'
    })
    assert.equal(extracted.wideStrings.byIndex[6], 'J1_CH2')
    assert.equal(extracted.binaryPrimitives.texts[0].text, 'J1_CH2')
    assert.equal(extracted.binaryPrimitives.texts[0].role, 'designator')
    assert.equal(extracted.diagnostics.primitiveParameterGroupCount, 1)
    assert.equal(extracted.diagnostics.wideStringCount, 1)
})

/**
 * Verifies via-protection sidecar records are parsed and attached to the
 * corresponding via primitive.
 */
test('PcbStreamExtractor extracts via structure sidecars', () => {
    const extracted = PcbStreamExtractor.extractFromStreams(
        PcbStreamTestFactory.createStreamMapWithViaStructure()
    )

    assert.equal(extracted.viaStructures.structures.length, 1)
    assert.deepEqual(extracted.viaStructures.structures[0], {
        index: 0,
        ipc4761Type: 4,
        structureType: 4,
        sourceStream: 'ViaStructures/Data',
        features: [
            {
                index: 0,
                type: 'plugged',
                side: 'top',
                material: 'nonconductive epoxy'
            },
            {
                index: 1,
                type: 'capped',
                side: 'bottom',
                material: 'copper'
            }
        ]
    })
    assert.deepEqual(extracted.viaStructures.links, [
        {
            primitiveIndex: 0,
            viaStructureIndex: 0,
            sourceStream: 'ViaStructureManager/Data'
        }
    ])
    assert.equal(extracted.binaryPrimitives.vias[0].viaStructureIndex, 0)
    assert.equal(extracted.binaryPrimitives.vias[0].ipc4761Type, 4)
    assert.deepEqual(extracted.binaryPrimitives.vias[0].viaProtection, {
        ipc4761Type: 4,
        structureType: 4,
        features: extracted.viaStructures.structures[0].features
    })
    assert.equal(extracted.diagnostics.viaStructureCount, 1)
})

/**
 * Verifies PCB sidecar streams are decoded explicitly and linked to decoded
 * primitive records when they carry primitive indexes.
 */
test('PcbStreamExtractor extracts extended primitive, custom shape, and union sidecars', () => {
    const streams = PcbStreamTestFactory.createStreamMap()

    streams.set(
        'ExtendedPrimitiveInformation/Data',
        PcbSidecarTestFactory.createLengthPrefixedRecords([
            '|PRIMITIVEINDEX=0|PRIMITIVEOBJECTID=2|TYPE=Pad|PASTEMASKEXPANSIONMODE=2|PASTEMASKEXPANSION_MANUAL=-2mil|SOLDERMASKEXPANSIONMODE=1|SOLDERMASKEXPANSION_MANUAL=4mil'
        ])
    )
    streams.set(
        'CustomShapes/Data',
        PcbSidecarTestFactory.createLengthPrefixedRecords([
            '|PRIMITIVEINDEX=0|LAYER=Top Layer|LAYERID=1|REGIONINDEX=0'
        ])
    )
    streams.set(
        'UnionNames/Data',
        PcbSidecarTestFactory.createLengthPrefixedRecords([
            '|UNIONINDEX=1|NAME=Grouped'
        ])
    )
    streams.set(
        'SmartUnions/Data',
        PcbSidecarTestFactory.createLengthPrefixedRecords([
            '|UNIONINDEX=2|NAME=Stitch|UNIONTYPE=2|PRIMITIVEOBJECTID0=3|PRIMITIVEINDEX0=0'
        ])
    )

    const extracted = PcbStreamExtractor.extractFromStreams(streams)

    assert.equal(extracted.extendedPrimitiveInformation.entries.length, 1)
    assert.equal(extracted.customPadShapes.entries.length, 1)
    assert.equal(extracted.unions.userUnions.length, 1)
    assert.equal(extracted.unions.smartUnions.length, 1)
    assert.equal(
        extracted.binaryPrimitives.pads[0].extendedPrimitiveInformation
            .maskExpansion.paste.manualExpansion,
        -2
    )
    assert.deepEqual(extracted.binaryPrimitives.vias[0].unionMemberships, [
        {
            index: 2,
            name: 'Stitch',
            type: 2,
            typeName: 'via-stitching',
            sourceStream: 'SmartUnions/Data'
        }
    ])
    assert.equal(extracted.diagnostics.extendedPrimitiveInformationCount, 1)
    assert.equal(extracted.diagnostics.customPadShapeCount, 1)
    assert.equal(extracted.diagnostics.userUnionCount, 1)
    assert.equal(extracted.diagnostics.smartUnionCount, 1)
})

/**
 * Verifies non-primitive embedded payloads are exposed through a generic
 * inventory with stable byte metadata and diagnostics.
 */
test('PcbStreamExtractor exposes generic embedded file inventory', () => {
    const streams = new Map()

    streams.set('Board6/Data', PcbStreamTestFactory.createBoardStream())
    streams.set(
        'EmbeddedFiles/readme.txt',
        new TextEncoder().encode('assembly note')
    )
    streams.set(
        'EmbeddedFiles/icon.png',
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
    )
    streams.set('EmbeddedFiles/empty.bin', new Uint8Array())

    const extracted = PcbStreamExtractor.extractFromStreams(streams)

    assert.equal(
        extracted.embeddedFiles.schema,
        'altium-toolkit.embedded-files.a1'
    )
    assert.deepEqual(
        extracted.embeddedFiles.files.map((file) => ({
            sourceStream: file.sourceStream,
            name: file.name,
            format: file.format,
            byteLength: file.byteLength,
            checksumAlgorithm: file.checksum.algorithm
        })),
        [
            {
                sourceStream: 'EmbeddedFiles/icon.png',
                name: 'icon.png',
                format: 'png',
                byteLength: 6,
                checksumAlgorithm: 'fnv1a32'
            },
            {
                sourceStream: 'EmbeddedFiles/readme.txt',
                name: 'readme.txt',
                format: 'text',
                byteLength: 13,
                checksumAlgorithm: 'fnv1a32'
            }
        ]
    )
    assert.deepEqual(extracted.embeddedFiles.diagnostics, [
        {
            code: 'embedded-file.empty',
            severity: 'warning',
            sourceStream: 'EmbeddedFiles/empty.bin',
            message: 'Embedded payload stream was empty.'
        }
    ])
    assert.equal(extracted.diagnostics.embeddedFileCount, 2)
    assert.equal(extracted.diagnostics.embeddedFileIssueCount, 1)
})

/**
 * Verifies large printable PCB streams append records without exceeding
 * JavaScript engine argument limits.
 */
test('PcbStreamExtractor appends large printable record streams iteratively', () => {
    const recordCount = 140000
    const extracted = PcbStreamExtractor.extractFromStreams(
        new Map([
            [
                'Tracks6/Data',
                PcbStreamTestFactory.createLargePrintableStream(recordCount)
            ]
        ])
    )

    assert.equal(extracted.records.length, recordCount)
    assert.equal(extracted.records.at(0)?.sourceStream, 'Tracks6/Data')
    assert.equal(extracted.records.at(-1)?.fields.X, '139999mil')
})
