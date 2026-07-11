// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import {
    AltiumParser,
    DraftsmanDigestParser
} from '../../src/legacy-parser.mjs'

/**
 * Encodes text into an ArrayBuffer.
 * @param {string} text Text content.
 * @returns {ArrayBuffer}
 */
function encodeText(text) {
    const bytes = new TextEncoder().encode(text)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
}

/**
 * Encodes a tiny LZ4 frame with one literal-only compressed block.
 * @param {string} text Text content.
 * @returns {ArrayBuffer}
 */
function encodeLiteralLz4Frame(text) {
    const payload = new TextEncoder().encode(text)
    const literalLength = payload.length
    const literalTail = []
    let remainingLiteralLength = literalLength - 15

    if (literalLength >= 15) {
        while (remainingLiteralLength >= 255) {
            literalTail.push(255)
            remainingLiteralLength -= 255
        }
        literalTail.push(remainingLiteralLength)
    }

    const block = new Uint8Array(1 + literalTail.length + payload.byteLength)
    block[0] = Math.min(literalLength, 15) << 4
    block.set(literalTail, 1)
    block.set(payload, 1 + literalTail.length)

    const frame = new Uint8Array(4 + 3 + 4 + block.byteLength + 4)
    const view = new DataView(frame.buffer)
    let offset = 0
    frame.set([0x04, 0x22, 0x4d, 0x18], offset)
    offset += 4
    frame[offset] = 0x60
    offset += 1
    frame[offset] = 0x40
    offset += 1
    frame[offset] = 0
    offset += 1
    view.setUint32(offset, block.byteLength, true)
    offset += 4
    frame.set(block, offset)
    offset += block.byteLength
    view.setUint32(offset, 0, true)

    return frame.buffer
}

test('DraftsmanDigestParser extracts a read-only drawing digest', () => {
    const model = DraftsmanDigestParser.parse(
        'review.PCBDwf',
        encodeText(`<DraftsmanDocument SourceDocumentName="Board.PcbDoc">
    <Page Id="P1" Name="Assembly">
        <TitleBlock Id="T1" Title="Assembly View" DocumentNumber="DWG-1" />
        <Note Id="N1" Text="Inspect first article" X="10" Y="20" />
        <Image Id="I1" Name="logo.png" NativeFormat="PNG" ByteSize="1024" />
        <Table Id="U1" Name="Generic Table" />
    </Page>
    <Page Id="P2" Title="Drill View">
        <Text Id="N2" Text="Drill notes" />
    </Page>
</DraftsmanDocument>`)
    )

    assert.equal(model.kind, 'draftsman')
    assert.equal(model.fileType, 'PCBDwf')
    assert.equal(model.summary.pageCount, 2)
    assert.equal(model.summary.noteCount, 2)
    assert.equal(model.summary.imageCount, 1)
    assert.equal(model.summary.unsupportedRawItemCount, 1)
    assert.equal(model.draftsman.schema, 'altium-toolkit.draftsman.digest.a1')
    assert.equal(model.draftsman.sourceDocumentName, 'Board.PcbDoc')
    assert.deepEqual(model.draftsman.pages[0], {
        index: 0,
        id: 'P1',
        name: 'Assembly',
        title: 'Assembly',
        titleBlocks: [
            {
                id: 'T1',
                title: 'Assembly View',
                documentNumber: 'DWG-1',
                fields: {
                    Id: 'T1',
                    Title: 'Assembly View',
                    DocumentNumber: 'DWG-1'
                }
            }
        ],
        notes: [
            {
                id: 'N1',
                text: 'Inspect first article',
                x: 10,
                y: 20,
                fields: {
                    Id: 'N1',
                    Text: 'Inspect first article',
                    X: '10',
                    Y: '20'
                }
            }
        ],
        images: [
            {
                id: 'I1',
                name: 'logo.png',
                nativeFormat: 'PNG',
                byteSize: 1024,
                fields: {
                    Id: 'I1',
                    Name: 'logo.png',
                    NativeFormat: 'PNG',
                    ByteSize: '1024'
                }
            }
        ],
        zones: [],
        items: [
            {
                kind: 'title-block',
                id: 'T1',
                name: 'Assembly View'
            },
            {
                kind: 'note',
                id: 'N1',
                name: 'Inspect first article'
            },
            {
                kind: 'image',
                id: 'I1',
                name: 'logo.png'
            },
            {
                kind: 'table',
                id: 'U1',
                name: 'Generic Table'
            }
        ],
        unsupportedRawItems: [
            {
                kind: 'Table',
                id: 'U1',
                name: 'Generic Table',
                rawXml: '<Table Id="U1" Name="Generic Table" />',
                fields: {
                    Id: 'U1',
                    Name: 'Generic Table'
                }
            }
        ]
    })
})

test('DraftsmanDigestParser exposes page options and image payload manifests', () => {
    const model = DraftsmanDigestParser.parse(
        'review-options.PCBDwf',
        encodeText(`<DraftsmanDocument SourceDocumentName="Board.PcbDoc" DefaultFontName="Arial" GridSize="25" ShowGrid="True" SheetColor="#ffffff">
    <Page Id="P1" Name="Assembly" Width="1100" Height="850" MarginLeft="40" MarginRight="40" MarginTop="30" MarginBottom="30" StandardSheetSize="A4" Orientation="Landscape">
        <Zone Id="Z1" Name="A1" Row="A" Column="1" X1="0" Y1="0" X2="100" Y2="80" />
        <Image Id="I1" Name="logo.png" NativeFormat="PNG" WrapperType="bitmap-preview" PayloadBase64="RkFLRVBORw==" />
        <Picture Id="I2" Name="placeholder.bmp" Format="BMP" ByteSize="42" WrapperType="preview-only" />
    </Page>
</DraftsmanDocument>`)
    )

    assert.deepEqual(model.draftsman.documentOptions, {
        defaultFontName: 'Arial',
        gridSize: 25,
        showGrid: true,
        sheetColor: '#ffffff',
        fields: {
            SourceDocumentName: 'Board.PcbDoc',
            DefaultFontName: 'Arial',
            GridSize: '25',
            ShowGrid: 'True',
            SheetColor: '#ffffff'
        }
    })
    assert.deepEqual(model.draftsman.pages[0].pageSetup, {
        width: 1100,
        height: 850,
        standardSheetSize: 'A4',
        orientation: 'Landscape',
        margins: {
            left: 40,
            right: 40,
            top: 30,
            bottom: 30
        }
    })
    assert.deepEqual(model.draftsman.pages[0].zones, [
        {
            id: 'Z1',
            name: 'A1',
            row: 'A',
            column: '1',
            x1: 0,
            y1: 0,
            x2: 100,
            y2: 80,
            fields: {
                Id: 'Z1',
                Name: 'A1',
                Row: 'A',
                Column: '1',
                X1: '0',
                Y1: '0',
                X2: '100',
                Y2: '80'
            }
        }
    ])
    assert.deepEqual(model.draftsman.pages[0].items, [
        { kind: 'zone', id: 'Z1', name: 'A1' },
        { kind: 'image', id: 'I1', name: 'logo.png' },
        { kind: 'image', id: 'I2', name: 'placeholder.bmp' }
    ])
    assert.deepEqual(model.draftsman.imagePayloads, {
        schema: 'altium-toolkit.draftsman.image-payloads.a1',
        summary: {
            imageCount: 2,
            payloadCount: 1,
            diagnosticCount: 1
        },
        payloads: [
            {
                pageIndex: 0,
                imageId: 'I1',
                name: 'logo.png',
                nativeFormat: 'PNG',
                wrapperType: 'bitmap-preview',
                byteSize: 7,
                checksum: {
                    algorithm: 'fnv1a32',
                    value: '67ffa6b3'
                }
            }
        ],
        diagnostics: [
            {
                code: 'draftsman.image-payload.missing-bytes',
                severity: 'warning',
                pageIndex: 0,
                imageId: 'I2',
                name: 'placeholder.bmp',
                message: 'Draftsman image item did not include payload bytes.'
            }
        ]
    })
    assert.equal(model.draftsman.indexes.itemsById.I1.pageIndex, 0)
    assert.equal(model.draftsman.indexes.imagesById.I2.index, 1)
})

test('DraftsmanDigestParser preserves unsupported XML subtrees', () => {
    const model = DraftsmanDigestParser.parse(
        'review.PCBDwf',
        encodeText(`<DraftsmanDocument>
    <Page Id="P1">
        <DrawingView Id="D1" Name="Assembly">
            <Child Id="C1" Name="Nested" />
        </DrawingView>
    </Page>
</DraftsmanDocument>`)
    )

    assert.deepEqual(model.draftsman.pages[0].unsupportedRawItems, [
        {
            kind: 'DrawingView',
            id: 'D1',
            name: 'Assembly',
            rawXml: [
                '<DrawingView Id="D1" Name="Assembly">',
                '            <Child Id="C1" Name="Nested" />',
                '        </DrawingView>'
            ].join('\n'),
            fields: {
                Id: 'D1',
                Name: 'Assembly'
            }
        }
    ])
})

test('DraftsmanDigestParser exposes board-view cache metadata', () => {
    const model = DraftsmanDigestParser.parse(
        'board-cache.PCBDwf',
        encodeText(`<DraftsmanDocument SourceDocumentName="Board.PcbDoc">
    <LayerColor Id="LC1" LayerId="1" LayerName="Top Layer" Role="signal" Color="#ff0000" />
    <LayerColor Id="LC2" LayerId="32" LayerName="Bottom Layer" Role="signal" Color="#0000ff" />
    <PCBParameter Name="BoardWidth" Value="2500mil" />
    <PCBParameter Name="Via_Count" Value="12" />
    <BoardAssemblyView Id="A1" PageId="P1" SourceDocumentName="Board.PcbDoc" VariantName="Assembly A" LayerSet="top,bottom" />
    <BoardFabricationView Id="F1" PageId="P1" SourceDocumentName="Board.PcbDoc" DrillTableId="D1" />
    <BoardProjection Id="PJT1" Source="cache" Width="2500" Height="1500" Scale="1.25" />
    <BoardCacheLayer Id="CL1" LayerId="1" LayerName="Top Layer" Role="signal" Color="#ff0000" PrimitiveCount="2" />
    <BoardDisplayLayer Id="DL1" CacheLayerId="CL1" Role="selected-route" Color="#00ff00" Visible="true" />
    <BoardHighlightGroup Id="HG1" Name="Fast Routes" SelectorKind="net-class" NetClasses="Fast" DifferentialPairClasses="DiffFast" DifferentialPairs="DATA" Nets="DATA_A" HighlightColor="#00ff00" ContextColor="#333333" MinimumRoutedLength="100mil" ConnectedRouteOnly="true" TargetFillRatio="0.65" TileSpacing="12" LayerSet="1,32" />
    <Page Id="P1" Name="Assembly">
        <BoardView Id="A1" Name="Assembly Top" GeometrySource="cache" PrimitiveCount="44" />
        <BoardLayerTile Id="LT1" HighlightGroupId="HG1" LayerId="1" LayerName="Top Layer" Row="0" Column="0" X="10" Y="20" Width="100" Height="80" Scale="1.5" />
        <BoardCachePrimitive Id="CP1" CacheLayerId="CL1" PrimitiveKind="track" LayerId="1" Net="DATA_A" NetClass="Fast" RouteGroup="RG1" HighlightState="selected" HoleRender="none" />
        <BoardCachePrimitive Id="CP2" CacheLayerId="CL1" PrimitiveKind="via-hole" LayerId="1" Net="DATA_A" HoleKind="round" HolePlating="plated" HoleRender="covered" />
    </Page>
</DraftsmanDocument>`)
    )

    assert.deepEqual(model.draftsman.boardViewMetadata, {
        schema: 'altium-toolkit.draftsman.board-view-cache.a1',
        summary: {
            layerColorCount: 2,
            pcbParameterCount: 2,
            boardAssemblyViewCount: 1,
            boardFabricationViewCount: 1,
            boardProjectionCount: 1,
            generatedGeometryCount: 1,
            cacheLayerCount: 1,
            displayLayerCount: 1,
            cachePrimitiveCount: 2,
            selectedRoutePrimitiveCount: 1,
            drillPrimitiveCount: 1,
            highlightGroupCount: 1,
            layerTileCount: 1,
            diagnosticCount: 0
        },
        layerColors: [
            {
                id: 'LC1',
                layerId: 1,
                layerName: 'Top Layer',
                role: 'signal',
                color: '#ff0000',
                fields: {
                    Id: 'LC1',
                    LayerId: '1',
                    LayerName: 'Top Layer',
                    Role: 'signal',
                    Color: '#ff0000'
                }
            },
            {
                id: 'LC2',
                layerId: 32,
                layerName: 'Bottom Layer',
                role: 'signal',
                color: '#0000ff',
                fields: {
                    Id: 'LC2',
                    LayerId: '32',
                    LayerName: 'Bottom Layer',
                    Role: 'signal',
                    Color: '#0000ff'
                }
            }
        ],
        pcbParameters: {
            BoardWidth: '2500mil',
            Via_Count: '12'
        },
        boardAssemblyViews: [
            {
                id: 'A1',
                pageId: 'P1',
                sourceDocumentName: 'Board.PcbDoc',
                variantName: 'Assembly A',
                layerSet: ['top', 'bottom'],
                fields: {
                    Id: 'A1',
                    PageId: 'P1',
                    SourceDocumentName: 'Board.PcbDoc',
                    VariantName: 'Assembly A',
                    LayerSet: 'top,bottom'
                }
            }
        ],
        boardFabricationViews: [
            {
                id: 'F1',
                pageId: 'P1',
                sourceDocumentName: 'Board.PcbDoc',
                drillTableId: 'D1',
                fields: {
                    Id: 'F1',
                    PageId: 'P1',
                    SourceDocumentName: 'Board.PcbDoc',
                    DrillTableId: 'D1'
                }
            }
        ],
        boardProjections: [
            {
                id: 'PJT1',
                source: 'cache',
                width: 2500,
                height: 1500,
                scale: 1.25,
                fields: {
                    Id: 'PJT1',
                    Source: 'cache',
                    Width: '2500',
                    Height: '1500',
                    Scale: '1.25'
                }
            }
        ],
        generatedGeometry: [
            {
                pageIndex: 0,
                pageId: 'P1',
                id: 'A1',
                name: 'Assembly Top',
                geometrySource: 'cache',
                primitiveCount: 44,
                fields: {
                    Id: 'A1',
                    Name: 'Assembly Top',
                    GeometrySource: 'cache',
                    PrimitiveCount: '44'
                }
            }
        ],
        cacheLayers: [
            {
                id: 'CL1',
                layerId: 1,
                layerKey: 'L1',
                layerName: 'Top Layer',
                role: 'signal',
                color: '#ff0000',
                primitiveCount: 2,
                fields: {
                    Id: 'CL1',
                    LayerId: '1',
                    LayerName: 'Top Layer',
                    Role: 'signal',
                    Color: '#ff0000',
                    PrimitiveCount: '2'
                }
            }
        ],
        displayLayers: [
            {
                id: 'DL1',
                cacheLayerId: 'CL1',
                role: 'selected-route',
                color: '#00ff00',
                visible: true,
                fields: {
                    Id: 'DL1',
                    CacheLayerId: 'CL1',
                    Role: 'selected-route',
                    Color: '#00ff00',
                    Visible: 'true'
                }
            }
        ],
        cachePrimitives: [
            {
                pageIndex: 0,
                pageId: 'P1',
                id: 'CP1',
                cacheLayerId: 'CL1',
                primitiveKind: 'track',
                layerId: 1,
                layerKey: 'L1',
                net: 'DATA_A',
                netClass: 'Fast',
                routeGroup: 'RG1',
                highlightState: 'selected',
                holeRender: 'none',
                fields: {
                    Id: 'CP1',
                    CacheLayerId: 'CL1',
                    PrimitiveKind: 'track',
                    LayerId: '1',
                    Net: 'DATA_A',
                    NetClass: 'Fast',
                    RouteGroup: 'RG1',
                    HighlightState: 'selected',
                    HoleRender: 'none'
                }
            },
            {
                pageIndex: 0,
                pageId: 'P1',
                id: 'CP2',
                cacheLayerId: 'CL1',
                primitiveKind: 'via-hole',
                layerId: 1,
                layerKey: 'L1',
                net: 'DATA_A',
                holeKind: 'round',
                holePlating: 'plated',
                holeRender: 'covered',
                fields: {
                    Id: 'CP2',
                    CacheLayerId: 'CL1',
                    PrimitiveKind: 'via-hole',
                    LayerId: '1',
                    Net: 'DATA_A',
                    HoleKind: 'round',
                    HolePlating: 'plated',
                    HoleRender: 'covered'
                }
            }
        ],
        highlightGroups: [
            {
                id: 'HG1',
                name: 'Fast Routes',
                selectorKind: 'net-class',
                netClasses: ['Fast'],
                differentialPairClasses: ['DiffFast'],
                differentialPairs: ['DATA'],
                nets: ['DATA_A'],
                highlightColor: '#00ff00',
                contextColor: '#333333',
                minimumRoutedLength: '100mil',
                connectedRouteOnly: true,
                targetFillRatio: 0.65,
                tileSpacing: 12,
                layerSet: ['1', '32'],
                fields: {
                    Id: 'HG1',
                    Name: 'Fast Routes',
                    SelectorKind: 'net-class',
                    NetClasses: 'Fast',
                    DifferentialPairClasses: 'DiffFast',
                    DifferentialPairs: 'DATA',
                    Nets: 'DATA_A',
                    HighlightColor: '#00ff00',
                    ContextColor: '#333333',
                    MinimumRoutedLength: '100mil',
                    ConnectedRouteOnly: 'true',
                    TargetFillRatio: '0.65',
                    TileSpacing: '12',
                    LayerSet: '1,32'
                }
            }
        ],
        layerTiles: [
            {
                pageIndex: 0,
                pageId: 'P1',
                id: 'LT1',
                highlightGroupId: 'HG1',
                layerId: 1,
                layerKey: 'L1',
                layerName: 'Top Layer',
                row: 0,
                column: 0,
                x: 10,
                y: 20,
                width: 100,
                height: 80,
                scale: 1.5,
                fields: {
                    Id: 'LT1',
                    HighlightGroupId: 'HG1',
                    LayerId: '1',
                    LayerName: 'Top Layer',
                    Row: '0',
                    Column: '0',
                    X: '10',
                    Y: '20',
                    Width: '100',
                    Height: '80',
                    Scale: '1.5'
                }
            }
        ],
        diagnostics: []
    })
})

test('AltiumParser routes PCBDwf buffers into Draftsman digest models', () => {
    const model = AltiumParser.parseArrayBufferToRendererModel(
        'review.PCBDwf',
        encodeText('<DraftsmanDocument><Page Id="P1" /></DraftsmanDocument>')
    )

    assert.equal(model.kind, 'draftsman')
    assert.equal(model.fileType, 'PCBDwf')
    assert.equal(model.summary.pageCount, 1)
})

test('DraftsmanDigestParser decodes legacy LZ4 text containers', () => {
    const model = DraftsmanDigestParser.parse(
        'compressed.PCBDwf',
        encodeLiteralLz4Frame(
            '<DraftsmanDocument><Page Id="P1" Title="Compressed" /></DraftsmanDocument>'
        )
    )

    assert.equal(model.summary.pageCount, 1)
    assert.equal(model.draftsman.pages[0].title, 'Compressed')
    assert.equal(model.diagnostics[0].code, 'draftsman.digest.lz4-container')
})

test('DraftsmanDigestParser degrades unsupported binary payloads into diagnostics', () => {
    const model = DraftsmanDigestParser.parse(
        'binary.PCBDwf',
        new Uint8Array([0, 1, 2, 3]).buffer
    )

    assert.equal(model.kind, 'draftsman')
    assert.equal(model.summary.pageCount, 0)
    assert.equal(
        model.diagnostics[0].code,
        'draftsman.digest.unsupported-container'
    )
})

test('DraftsmanDigestParser exposes typed styles, note geometry, and picture geometry', () => {
    const model = DraftsmanDigestParser.parse(
        'review-styles.PCBDwf',
        encodeText(`<DraftsmanDocument SourceDocumentName="Board.PcbDoc" DocumentId="DWG-A" Revision="A">
    <FontStyle Id="FS1" FontName="Arial" Size="11" Bold="True" Italic="False" Color="#202020" />
    <Page Id="P1" Name="Notes" Width="1000" Height="700" BorderStyle="zone-grid" SheetTemplate="A4">
        <Note Id="N1" Text="Check item" X="20" Y="40" Width="160" Height="50" Alignment="Center" VerticalAlignment="Middle" BorderWidth="2" BorderStyle="Round" BorderColor="#000000" FillColor="#ffffee" ShowBorder="True" FontStyleId="FS1" />
        <Picture Id="PIC1" Name="mark.png" NativeFormat="PNG" WrapperType="native" X="300" Y="120" Width="80" Height="40" Rotation="90" />
    </Page>
</DraftsmanDocument>`)
    )

    assert.deepEqual(model.draftsman.documentOptions, {
        documentId: 'DWG-A',
        revision: 'A',
        fields: {
            SourceDocumentName: 'Board.PcbDoc',
            DocumentId: 'DWG-A',
            Revision: 'A'
        }
    })
    assert.deepEqual(model.draftsman.styles, {
        fontStyles: [
            {
                id: 'FS1',
                fontName: 'Arial',
                size: 11,
                bold: true,
                italic: false,
                color: '#202020',
                fields: {
                    Id: 'FS1',
                    FontName: 'Arial',
                    Size: '11',
                    Bold: 'True',
                    Italic: 'False',
                    Color: '#202020'
                }
            }
        ]
    })
    assert.deepEqual(model.draftsman.pages[0].pageSetup, {
        width: 1000,
        height: 700,
        sheetTemplate: 'A4',
        borderStyle: 'zone-grid'
    })
    assert.deepEqual(model.draftsman.pages[0].notes, [
        {
            id: 'N1',
            text: 'Check item',
            x: 20,
            y: 40,
            width: 160,
            height: 50,
            alignment: 'center',
            verticalAlignment: 'middle',
            fontStyleId: 'FS1',
            border: {
                width: 2,
                style: 'round',
                color: '#000000',
                visible: true
            },
            fillColor: '#ffffee',
            fields: {
                Id: 'N1',
                Text: 'Check item',
                X: '20',
                Y: '40',
                Width: '160',
                Height: '50',
                Alignment: 'Center',
                VerticalAlignment: 'Middle',
                BorderWidth: '2',
                BorderStyle: 'Round',
                BorderColor: '#000000',
                FillColor: '#ffffee',
                ShowBorder: 'True',
                FontStyleId: 'FS1'
            }
        }
    ])
    assert.deepEqual(model.draftsman.pages[0].images, [
        {
            id: 'PIC1',
            name: 'mark.png',
            nativeFormat: 'PNG',
            wrapperType: 'native',
            x: 300,
            y: 120,
            width: 80,
            height: 40,
            rotation: 90,
            fields: {
                Id: 'PIC1',
                Name: 'mark.png',
                NativeFormat: 'PNG',
                WrapperType: 'native',
                X: '300',
                Y: '120',
                Width: '80',
                Height: '40',
                Rotation: '90'
            }
        }
    ])
    assert.equal(model.summary.fontStyleCount, 1)
})
