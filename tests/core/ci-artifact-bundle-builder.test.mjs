// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import {
    CiArtifactBundleBuilder,
    PrjPcbModelParser
} from '../../src/parser.mjs'

/**
 * Encodes project text into an ArrayBuffer.
 * @param {string} text Project text.
 * @returns {ArrayBuffer}
 */
function encodeProject(text) {
    const bytes = new TextEncoder().encode(text)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
}

/**
 * Creates a compact synthetic project model for bundle assembly.
 * @returns {object}
 */
function createProjectModel() {
    return PrjPcbModelParser.parse(
        'ci-pack.PrjPcb',
        encodeProject(`[Design]
CurrentVariant=Assembly A

[Document1]
DocumentPath=Main.SchDoc
DocumentUniqueId=SCH-1

[Document2]
DocumentPath=Board.PcbDoc
DocumentUniqueId=PCB-1

[OutputGroup1]
Name=Review
OutputType1=Pdf
OutputName1=Review Pack
OutputDocumentPath1=Board.PcbDoc

[ProjectVariant1]
UniqueId=VAR-A
Description=Assembly A
AllowFabrication=1
VariationCount=0
ParamVariationCount=0
`)
    )
}

/**
 * Creates synthetic schematic and PCB models used by CI bundle tests.
 * @returns {object[]}
 */
function createDocumentModels() {
    const line = {
        recordId: 'wire-a',
        x1: 20,
        y1: 40,
        x2: 120,
        y2: 40,
        width: 1,
        color: '#000080'
    }
    const label = {
        recordId: 'label-a',
        recordType: '25',
        x: 70,
        y: 40,
        text: 'NET_A',
        color: '#000080'
    }
    const pin = {
        recordId: 'pin-a',
        ownerIndex: '1',
        designator: '1',
        name: 'IN',
        x: 140,
        y: 40,
        length: 20,
        orientation: 'left'
    }

    return [
        {
            kind: 'schematic',
            fileType: 'SchDoc',
            fileName: 'Main.SchDoc',
            summary: { title: 'Main' },
            diagnostics: [],
            schematic: {
                sheet: { width: 180, height: 100 },
                lines: [line],
                texts: [label],
                components: [
                    {
                        recordId: 'component-a',
                        ownerIndex: '1',
                        designator: 'U1',
                        uniqueId: 'U1-SCH',
                        libReference: 'LOGIC_FAKE',
                        value: 'Controller'
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
            },
            bom: [
                {
                    designators: ['U1'],
                    quantity: 1,
                    pattern: '',
                    source: 'LOGIC_FAKE',
                    value: 'Controller'
                }
            ]
        },
        {
            kind: 'pcb',
            fileType: 'PcbDoc',
            fileName: 'Board.PcbDoc',
            summary: { title: 'Board' },
            diagnostics: [],
            pcb: {
                boardOutline: {
                    minX: 0,
                    minY: 0,
                    widthMil: 250,
                    heightMil: 150,
                    segments: []
                },
                layers: [
                    { id: 1, name: 'Top Layer', role: 'copper' },
                    { id: 33, name: 'Top Overlay', role: 'overlay' }
                ],
                components: [
                    {
                        componentIndex: 0,
                        designator: 'U1',
                        uniqueId: 'U1-PCB',
                        pattern: 'QFN_FAKE',
                        layer: 'top',
                        x: 150,
                        y: 40,
                        rotation: 0
                    }
                ],
                nets: [{ netIndex: 0, name: 'NET_A', uniqueId: 'NET-1' }],
                tracks: [
                    {
                        x1: 20,
                        y1: 40,
                        x2: 120,
                        y2: 40,
                        width: 6,
                        layerId: 1,
                        net: 'NET_A'
                    }
                ],
                vias: [
                    {
                        x: 90,
                        y: 40,
                        diameter: 20,
                        holeDiameter: 10,
                        layerId: 1,
                        net: 'NET_A'
                    }
                ],
                pads: [
                    {
                        x: 150,
                        y: 40,
                        sizeTopX: 24,
                        sizeTopY: 24,
                        layerId: 1,
                        padNumber: '1',
                        designator: '1',
                        componentIndex: 0,
                        net: 'NET_A',
                        holeDiameter: 0
                    }
                ],
                texts: []
            },
            pnp: {
                positionMode: 'altium-pick-place',
                entries: [{ designator: 'U1', x: 150, y: 40, rotation: 0 }]
            },
            bom: [
                {
                    designators: ['U1'],
                    quantity: 1,
                    pattern: 'QFN_FAKE',
                    source: 'LOGIC_FAKE',
                    value: 'Controller'
                }
            ]
        }
    ]
}

test('CiArtifactBundleBuilder packages deterministic project review outputs', () => {
    const options = {
        projectModel: createProjectModel(),
        documentModels: createDocumentModels(),
        variantName: 'Assembly A'
    }
    const bundle = CiArtifactBundleBuilder.build(options)
    const repeat = CiArtifactBundleBuilder.build(options)

    assert.equal(bundle.schema, 'altium-toolkit.ci.artifact-bundle.a1')
    assert.equal(bundle.summary.normalizedModelCount, 2)
    assert.equal(bundle.summary.schematicSvgCount, 1)
    assert.equal(bundle.summary.pcbLayerSvgCount, 2)
    assert.equal(bundle.summary.netCount, 1)
    assert.equal(bundle.summary.bomRowCount, 1)
    assert.equal(bundle.summary.pnpCount, 1)
    assert.equal(bundle.designBundle.kind, 'design-bundle')
    assert.deepEqual(bundle.units, {
        coordinate: 'mil',
        length: 'mil',
        board: 'mil',
        pnp: 'mil',
        angle: 'deg'
    })
    assert.deepEqual(bundle.designBundle.units, bundle.units)
    assert.equal(
        bundle.documentGraph.schema,
        'altium-toolkit.project.document-graph.a1'
    )
    assert.deepEqual(
        bundle.normalizedModels.map((model) => model.fileName),
        ['Main.SchDoc', 'Board.PcbDoc']
    )
    assert.equal(bundle.netlist.json.schema, 'altium-toolkit.netlist.a1')
    assert.deepEqual(bundle.netlist.json.units, {
        coordinate: 'mil',
        length: 'mil'
    })
    assert.match(bundle.netlist.wirelist, /net NET_A/u)
    assert.equal(bundle.bom.rows.length, 1)
    assert.equal(bundle.pnp.entries.length, 1)
    assert.deepEqual(bundle.pnp.units, { coordinate: 'mil', angle: 'deg' })
    assert.match(bundle.schematicSvgs[0].svg, /schematic-semantic-metadata/u)
    assert.deepEqual(
        bundle.pcbLayerSvgs[0].layers.map((layer) => layer.layerKey),
        ['L1', 'L33']
    )
    assert.equal(
        bundle.statistics.pcb[0].statistics.schema,
        'altium-toolkit.pcb.statistics.a1'
    )
    assert.deepEqual(bundle.statistics.pcb[0].statistics.units, {
        coordinate: 'mil',
        length: 'mil',
        board: 'mil',
        drill: 'mil',
        thickness: 'mil',
        copperWeight: 'oz',
        angle: 'deg'
    })
    assert.equal(JSON.stringify(bundle), JSON.stringify(repeat))
})
