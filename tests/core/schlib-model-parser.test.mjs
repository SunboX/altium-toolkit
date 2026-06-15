// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import test from 'node:test'
import { AltiumParser, LibrarySearchIndex } from '../../src/parser.mjs'
import { OleCompoundDocumentWriter } from '../../src/core/ole/OleCompoundDocumentWriter.mjs'

/**
 * Verifies native schematic library compound documents become read-only
 * schematic-library parser roots.
 */
test('AltiumParser parses native schematic libraries', () => {
    const model = AltiumParser.parseArrayBufferToRendererModel(
        'logic-symbols.SchLib',
        SchLibModelParserTestFactory.createLibraryBuffer()
    )

    assert.equal(model.kind, 'schematic-library')
    assert.equal(model.fileType, 'SchLib')
    assert.deepEqual(model.summary, {
        title: 'logic-symbols',
        symbolCount: 1,
        pinCount: 2,
        partCount: 2,
        embeddedAssetCount: 1,
        nativeStreamCount: 4,
        opaqueRecordCount: 1
    })
    assert.deepEqual(model.schematicLibrary.indexes.symbolsByName, {
        CTRL_CORE: {
            index: 0,
            name: 'CTRL_CORE',
            sourceStorage: 'Components/CTRL_CORE',
            pinCount: 2,
            partCount: 2,
            keywordCount: 4
        }
    })
    assert.deepEqual(model.schematicLibrary.symbols[0], {
        name: 'CTRL_CORE',
        displayName: 'Control Core',
        sourceId: 'ctrl-core',
        sourceStorage: 'Components/CTRL_CORE',
        sourceStream: 'Components/CTRL_CORE/Data',
        declaredPinCount: 2,
        declaredPrimitiveCount: 2,
        pins: [
            {
                designator: '1',
                name: 'VIN',
                partId: 'A',
                electricalType: 'input',
                x: 10,
                y: 20,
                length: 30
            },
            {
                designator: '2',
                name: 'VOUT',
                partId: 'B',
                electricalType: 'output',
                x: 90,
                y: 20,
                length: 30
            }
        ],
        parts: [
            { partId: 'A', pinCount: 1, primitiveCount: 1 },
            { partId: 'B', pinCount: 1, primitiveCount: 1 }
        ],
        parameters: {
            Description: 'Controller symbol'
        },
        implementations: [
            {
                modelName: 'PKG_CTRL',
                modelType: 'pcb',
                targetLibraries: ['Packages.PcbLib']
            }
        ],
        primitives: [
            {
                recordType: 'Rectangle',
                recordIndex: 5,
                partId: 'A'
            },
            {
                recordType: 'Rectangle',
                recordIndex: 6,
                partId: 'B'
            }
        ],
        embeddedAssets: [
            {
                sourceStream: 'Components/CTRL_CORE/Images/logo.png',
                name: 'logo.png',
                format: 'png',
                byteLength: 8,
                checksum: {
                    algorithm: 'fnv1a32',
                    value: '255c756c'
                }
            }
        ],
        opaqueRecords: [
            {
                source: 'schlib',
                sourceStorage: 'Components/CTRL_CORE',
                sourceStream: 'Components/CTRL_CORE/Opaque',
                frameType: 7,
                recordIndex: 0,
                byteLength: 3,
                rawBase64: 'qrvM'
            }
        ]
    })
    assert.equal(model.schematicLibrary.renderManifest.outputs.length, 2)
    assert.equal(model.schematicLibrary.qa.summary.issueCount, 0)
    assert.deepEqual(
        LibrarySearchIndex.searchSchematicSymbols(
            model.schematicLibrary,
            'controller symbol'
        ).matches.map((match) => ({
            name: match.name,
            matchKind: match.matchKind
        })),
        [{ name: 'CTRL_CORE', matchKind: 'keyword' }]
    )
})

/**
 * Verifies schematic libraries expose section-keyed root component storages,
 * file-header metadata, compressed storage images, and pin side-stream fields.
 */
test('AltiumParser preserves schematic library side-stream fidelity', () => {
    const model = AltiumParser.parseArrayBufferToRendererModel(
        'fidelity-symbols.SchLib',
        SchLibModelParserTestFactory.createFidelityBuffer()
    )
    const symbol = model.schematicLibrary.symbols[0]

    assert.deepEqual(model.schematicLibrary.sectionKeys, [
        {
            libReference: 'ROOT_GATE',
            sectionKey: 'RootGate',
            sourceStream: 'SectionKeys',
            recordIndex: 0
        }
    ])
    assert.deepEqual(model.schematicLibrary.libraryHeader.fileHeader, {
        header: 'Schematic Library',
        fonts: [
            {
                index: 1,
                name: 'Arial',
                size: 10,
                id: 1
            }
        ]
    })
    assert.equal(symbol.sourceStorage, 'RootGate')
    assert.deepEqual(symbol.pins[0], {
        designator: '1',
        name: 'A0',
        partId: 'A',
        electricalType: 'passive',
        formalType: 'input',
        description: 'Analog input',
        pinFunction: 'Clock',
        x: 10.5,
        y: 20.25,
        length: 32.75,
        pinPackageLength: 45,
        symbolInner: 'dot',
        symbolOuter: 'clock',
        symbolLineWidth: 2,
        swapIdPart: 7,
        swapIdPin: 8,
        textStyle: {
            nameFontId: 2,
            designatorFontId: 3,
            namePosition: 'inside',
            designatorPosition: 'outside'
        }
    })
    assert.deepEqual(symbol.implementations[0], {
        modelName: 'PKG_GATE',
        modelType: 'pcb',
        targetLibraries: ['PanelFootprints.PcbLib'],
        searchPaths: ['Models'],
        mapDefiners: [
            {
                recordKey: 'schematic-record-4',
                designatorInterface: 'A',
                implementationDesignators: ['U1']
            }
        ],
        parameters: [
            {
                recordKey: 'schematic-record-5',
                name: 'Lifecycle',
                value: 'Prototype'
            }
        ]
    })
    assert.deepEqual(symbol.embeddedAssets, [
        {
            sourceStream: 'RootGate/Storage',
            name: 'Storage',
            format: 'png',
            byteLength: 8,
            compression: 'zlib',
            checksum: {
                algorithm: 'fnv1a32',
                value: '255c756c'
            }
        }
    ])
    assert.equal(model.summary.embeddedAssetCount, 1)
})

/**
 * Test fixture builder for compact schematic-library OLE payloads.
 */
class SchLibModelParserTestFactory {
    /**
     * Creates one synthetic schematic-library ArrayBuffer.
     * @returns {ArrayBuffer}
     */
    static createLibraryBuffer() {
        const bytes = OleCompoundDocumentWriter.write({
            streams: new Map([
                [
                    'Library/Data',
                    SchLibModelParserTestFactory.#textBytes(
                        '|HEADER=Schematic Library|' +
                            '|RECORD=Component|Name=CTRL_CORE|DisplayName=Control Core|SourceId=ctrl-core|PinCount=2|PrimitiveCount=2'
                    )
                ],
                [
                    'Components/CTRL_CORE/Data',
                    SchLibModelParserTestFactory.#textBytes(
                        '|RECORD=Component|Name=CTRL_CORE|DisplayName=Control Core|SourceId=ctrl-core|PinCount=2|PrimitiveCount=2' +
                            '|RECORD=Pin|Designator=1|Name=VIN|PartId=A|ElectricalType=Input|Location.X=10|Location.Y=20|PinLength=30' +
                            '|RECORD=Pin|Designator=2|Name=VOUT|PartId=B|ElectricalType=Output|Location.X=90|Location.Y=20|PinLength=30' +
                            '|RECORD=Parameter|Name=Description|Text=Controller symbol' +
                            '|RECORD=Implementation|ModelName=PKG_CTRL|ModelType=PCB|TargetLibrary=Packages.PcbLib' +
                            '|RECORD=Rectangle|PartId=A|Location.X=0|Location.Y=0|Corner.X=50|Corner.Y=40' +
                            '|RECORD=Rectangle|PartId=B|Location.X=60|Location.Y=0|Corner.X=110|Corner.Y=40'
                    )
                ],
                [
                    'Components/CTRL_CORE/Images/logo.png',
                    new Uint8Array([
                        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
                    ])
                ],
                [
                    'Components/CTRL_CORE/Opaque',
                    SchLibModelParserTestFactory.#opaqueFrame()
                ]
            ])
        })

        return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        )
    }

    /**
     * Creates a schematic library that uses root storage and side streams.
     * @returns {ArrayBuffer}
     */
    static createFidelityBuffer() {
        const bytes = OleCompoundDocumentWriter.write({
            streams: new Map([
                [
                    'FileHeader',
                    SchLibModelParserTestFactory.#textBytes(
                        '|HEADER=Schematic Library|FontId1=1|FontName1=Arial|FontSize1=10'
                    )
                ],
                [
                    'SectionKeys',
                    SchLibModelParserTestFactory.#textBytes(
                        '|RECORD=SectionKey|LibReference=ROOT_GATE|SectionKey=RootGate'
                    )
                ],
                [
                    'RootGate/Data',
                    SchLibModelParserTestFactory.#textBytes(
                        '|RECORD=1|IndexInSheet=10|LibReference=ROOT_GATE|PinCount=1|PrimitiveCount=0' +
                            '|RECORD=2|Designator=1|Name=A0|PartId=A|ElectricalType=Passive|FormalType=Input|Location.X=10|Location.Y=20|PinLength=30|Symbol_Inner=Dot|Symbol_Outer=Clock|SwapIdPart=7|SwapIdPin=8' +
                            '|RECORD=44|IndexInSheet=20|OwnerIndex=10' +
                            '|RECORD=45|IndexInSheet=21|OwnerIndex=20|ModelName=PKG_GATE|ModelType=PCB|DatafileCount=1|ModelDatafileEntity0=PanelFootprints|ModelDatafileKind0=PcbLib|SearchPathCount=1|SearchPath0=Models' +
                            '|RECORD=47|OwnerIndex=21|DesIntf=A|DesImpCount=1|DesImp0=U1' +
                            '|RECORD=48|OwnerIndex=21|Name=Lifecycle|Text=Prototype'
                    )
                ],
                [
                    'RootGate/PinFrac',
                    SchLibModelParserTestFactory.#deflatedText(
                        '|RECORD=PinFrac|PinIndex=0|Location.X=10.5|Location.Y=20.25|PinLength=32.75'
                    )
                ],
                [
                    'RootGate/PinSymbolLineWidth',
                    SchLibModelParserTestFactory.#textBytes(
                        '|RECORD=PinSymbolLineWidth|PinIndex=0|SymbolLineWidth=2'
                    )
                ],
                [
                    'RootGate/PinDesc',
                    SchLibModelParserTestFactory.#textBytes(
                        '|RECORD=PinDesc|PinIndex=0|Description=Analog input'
                    )
                ],
                [
                    'RootGate/PinPackageLength',
                    SchLibModelParserTestFactory.#textBytes(
                        '|RECORD=PinPackageLength|PinIndex=0|PinPackageLength=45'
                    )
                ],
                [
                    'RootGate/PinFunctionData',
                    SchLibModelParserTestFactory.#textBytes(
                        '|RECORD=PinFunctionData|PinIndex=0|PinFunction=Clock'
                    )
                ],
                [
                    'RootGate/PinTextData',
                    SchLibModelParserTestFactory.#textBytes(
                        '|RECORD=PinTextData|PinIndex=0|NameFontId=2|DesignatorFontId=3|NamePosition=Inside|DesignatorPosition=Outside'
                    )
                ],
                [
                    'RootGate/Storage',
                    Uint8Array.from(
                        deflateSync(SchLibModelParserTestFactory.#pngBytes())
                    )
                ]
            ])
        })

        return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        )
    }

    /**
     * Encodes text as UTF-8 bytes.
     * @param {string} text Text payload.
     * @returns {Uint8Array}
     */
    static #textBytes(text) {
        return new TextEncoder().encode(text)
    }

    /**
     * Encodes text and wraps it in a zlib stream.
     * @param {string} text Text payload.
     * @returns {Uint8Array}
     */
    static #deflatedText(text) {
        return Uint8Array.from(deflateSync(new TextEncoder().encode(text)))
    }

    /**
     * Returns a compact PNG signature payload.
     * @returns {Uint8Array}
     */
    static #pngBytes() {
        return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    }

    /**
     * Creates one native framed opaque payload.
     * @returns {Uint8Array}
     */
    static #opaqueFrame() {
        const payload = new Uint8Array([0xaa, 0xbb, 0xcc])
        const bytes = new Uint8Array(4 + payload.byteLength)
        const view = new DataView(bytes.buffer)

        view.setUint16(0, payload.byteLength, true)
        bytes[2] = 0
        bytes[3] = 7
        bytes.set(payload, 4)

        return bytes
    }
}
