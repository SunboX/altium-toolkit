// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import {
    ProjectAnnotationParser,
    ProjectDesignBundleBuilder,
    ProjectNetlistExporter,
    ProjectVariantViewBuilder
} from '../../src/parser.mjs'
import { PrjPcbModelParser } from '../../src/core/altium/PrjPcbModelParser.mjs'

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
 * Creates a compact synthetic project model with one active variant.
 * @returns {ReturnType<typeof PrjPcbModelParser.parse>}
 */
function createProjectModel() {
    return PrjPcbModelParser.parse(
        'bundle-check.PrjPcb',
        encodeProject(`[Design]
HierarchyMode=2
CurrentVariant=Assembly B

[Document1]
DocumentPath=Main.SchDoc
DocumentUniqueId=SCH-1

[Document2]
DocumentPath=Board.PcbDoc
DocumentUniqueId=PCB-1

[ProjectVariant1]
UniqueId=VAR-B
Description=Assembly B
AllowFabrication=1
VariationCount=1
Variation1=Designator=R1|UniqueId=R1-UID|Kind=1
ParamVariationCount=1
ParamDesignator1=U1
ParamVariation1=ParameterName=Comment|VariantValue=Controller B
`)
    )
}

/**
 * Creates parsed document models that can be bundled above single-document
 * parser output.
 * @returns {object[]}
 */
function createDocumentModels() {
    return [
        {
            kind: 'schematic',
            fileType: 'SchDoc',
            fileName: 'Main.SchDoc',
            summary: { title: 'Main', componentCount: 2 },
            schematic: {
                sheet: { width: 200, height: 120 },
                sheetSymbols: [
                    {
                        uniqueId: 'SHEET-CHILD',
                        x: 20,
                        y: 80,
                        width: 80,
                        height: 40
                    }
                ],
                sheetEntries: [
                    {
                        ownerIndex: '1',
                        name: 'NET_A',
                        direction: 'input',
                        x: 20,
                        y: 60
                    }
                ],
                components: [
                    {
                        designator: 'U1',
                        uniqueId: 'U1-UID',
                        libReference: 'LOGIC_FAKE',
                        value: 'Controller'
                    },
                    {
                        designator: 'R1',
                        uniqueId: 'R1-UID',
                        libReference: 'RES_FAKE',
                        value: '10K'
                    }
                ],
                nets: [
                    {
                        name: 'NET_A',
                        pins: [
                            {
                                designator: '1',
                                ownerIndex: 'U1',
                                name: 'CTRL_A'
                            },
                            {
                                designator: '2',
                                ownerIndex: 'R1',
                                name: 'RES_A'
                            }
                        ],
                        labels: [
                            {
                                text: 'NET_A',
                                x: 70,
                                y: 60,
                                recordType: '25'
                            }
                        ],
                        segments: [
                            {
                                x1: 20,
                                y1: 60,
                                x2: 160,
                                y2: 60,
                                recordType: '13'
                            }
                        ]
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
                },
                {
                    designators: ['R1'],
                    quantity: 1,
                    pattern: '',
                    source: 'RES_FAKE',
                    value: '10K'
                }
            ]
        },
        {
            kind: 'pcb',
            fileType: 'PcbDoc',
            fileName: 'Board.PcbDoc',
            summary: { title: 'Board', componentCount: 2 },
            pcb: {
                components: [
                    {
                        componentIndex: 0,
                        designator: 'U1',
                        uniqueId: 'PCB-U1',
                        pattern: 'QFN_FAKE'
                    },
                    {
                        componentIndex: 1,
                        designator: 'R1',
                        uniqueId: 'PCB-R1',
                        pattern: '0603_FAKE'
                    }
                ],
                nets: [{ netIndex: 0, name: 'NET_A', uniqueId: 'NET-1' }],
                pickPlace: {
                    positionMode: 'altium-pick-place',
                    entries: [
                        { designator: 'U1', x: 100, y: 120, rotation: 0 },
                        { designator: 'R1', x: 140, y: 120, rotation: 90 }
                    ]
                }
            },
            pnp: {
                positionMode: 'altium-pick-place',
                entries: [
                    { designator: 'U1', x: 100, y: 120, rotation: 0 },
                    { designator: 'R1', x: 140, y: 120, rotation: 90 }
                ]
            },
            bom: [
                {
                    designators: ['U1'],
                    quantity: 1,
                    pattern: 'QFN_FAKE',
                    source: 'LOGIC_FAKE',
                    value: 'Controller'
                },
                {
                    designators: ['R1'],
                    quantity: 1,
                    pattern: '0603_FAKE',
                    source: 'RES_FAKE',
                    value: '10K'
                }
            ]
        }
    ]
}

test('ProjectDesignBundleBuilder composes project and document models', () => {
    const bundle = ProjectDesignBundleBuilder.build({
        projectModel: createProjectModel(),
        documentModels: createDocumentModels(),
        variantName: 'Assembly B'
    })

    assert.equal(bundle.kind, 'design-bundle')
    assert.equal(bundle.fileType, 'ProjectDesignBundle')
    assert.equal(bundle.summary.sheetCount, 1)
    assert.equal(bundle.summary.componentCount, 2)
    assert.equal(bundle.summary.netCount, 1)
    assert.equal(bundle.summary.pnpCount, 2)
    assert.equal(bundle.project.name, 'bundle-check')
    assert.deepEqual(bundle.units, {
        coordinate: 'mil',
        length: 'mil',
        board: 'mil',
        pnp: 'mil',
        angle: 'deg'
    })
    assert.deepEqual(bundle.pnp.units, { coordinate: 'mil', angle: 'deg' })
    assert.equal(bundle.variants.length, 1)
    assert.deepEqual(
        bundle.sheets.map((sheet) => sheet.fileName),
        ['Main.SchDoc']
    )
    assert.deepEqual(bundle.schematic_hierarchy, {
        mode: '2',
        modeName: 'hierarchical',
        sheets: [
            {
                fileName: 'Main.SchDoc',
                documentPath: 'Main.SchDoc',
                uniqueId: 'SCH-1',
                title: 'Main'
            }
        ],
        sheetSymbols: [
            {
                sheetFileName: 'Main.SchDoc',
                uniqueId: 'SHEET-CHILD',
                entries: ['NET_A']
            }
        ]
    })
    assert.equal(bundle.indexes.componentsByDesignator.U1.bundleIndex, 0)
    assert.equal(bundle.indexes.netsByName.NET_A.bundleIndex, 0)
    assert.equal(bundle.indexes.sheetsByFileName['Main.SchDoc'].bundleIndex, 0)
    assert.equal(bundle.indexes.pnpByDesignator.R1.bundleIndex, 1)
    assert.equal(bundle.effectiveVariant.name, 'Assembly B')
    assert.deepEqual(
        bundle.effectiveVariant.pnp.entries.map((entry) => entry.designator),
        ['U1']
    )
})

test('ProjectVariantViewBuilder applies DNP and parameter overrides', () => {
    const bundle = ProjectDesignBundleBuilder.build({
        projectModel: createProjectModel(),
        documentModels: createDocumentModels()
    })
    const view = ProjectVariantViewBuilder.build(bundle, {
        variantName: 'Assembly B'
    })

    assert.equal(view.name, 'Assembly B')
    assert.deepEqual(view.dnp, ['R1'])
    assert.deepEqual(view.parameterOverrides, {
        U1: { Comment: 'Controller B' }
    })
    assert.deepEqual(
        view.bom.map((row) => ({
            designators: row.designators,
            quantity: row.quantity,
            value: row.value,
            parameters: row.parameters
        })),
        [
            {
                designators: ['U1'],
                quantity: 1,
                value: 'Controller B',
                parameters: { Comment: 'Controller B' }
            }
        ]
    )
    assert.deepEqual(
        view.pnp.entries.map((entry) => entry.designator),
        ['U1']
    )
    assert.deepEqual(view.nets[0].excludedDesignators, ['R1'])
    assert.deepEqual(view.components, [
        {
            designator: 'U1',
            schematic: {
                fileName: 'Main.SchDoc',
                uniqueId: 'U1-UID',
                libReference: 'LOGIC_FAKE',
                value: 'Controller'
            },
            pcb: {
                fileName: 'Board.PcbDoc',
                componentIndex: 0,
                uniqueId: 'PCB-U1',
                pattern: 'QFN_FAKE'
            },
            dnp: false,
            parameters: { Comment: 'Controller B' }
        },
        {
            designator: 'R1',
            schematic: {
                fileName: 'Main.SchDoc',
                uniqueId: 'R1-UID',
                libReference: 'RES_FAKE',
                value: '10K'
            },
            pcb: {
                fileName: 'Board.PcbDoc',
                componentIndex: 1,
                uniqueId: 'PCB-R1',
                pattern: '0603_FAKE'
            },
            dnp: true,
            parameters: {}
        }
    ])
})

/**
 * Verifies annotation mapping and alternate fitted component rows are applied
 * to effective variant BOM, PnP, component, and net outputs.
 */
test('ProjectVariantViewBuilder applies annotations and alternate fitted components', () => {
    const projectModel = PrjPcbModelParser.parse(
        'alternate-check.PrjPcb',
        encodeProject(`[Design]
CurrentVariant=Assembly C

[Document1]
DocumentPath=Main.SchDoc
DocumentUniqueId=SCH-1

[Document2]
DocumentPath=Board.PcbDoc
DocumentUniqueId=PCB-1

[ProjectVariant1]
UniqueId=VAR-C
Description=Assembly C
VariationCount=1
Variation1=Designator=U1|UniqueId=U1-UID|Kind=2|AlternatePart=LOGIC_ALT|AlternateLibReference=LOGIC_ALT_LIB|AlternateFootprint=QFN_ALT|AlternateComment=Controller C|AlternateDescription=Alternate controller
ParamVariationCount=0
`)
    )
    const annotationModel = ProjectAnnotationParser.parseText(
        'assembly.Annotation',
        `[Annotation1]
SourceDesignator=U1
CompiledDesignator=U101
UniqueId=U1-UID

[Annotation2]
SourceDesignator=R1
CompiledDesignator=R201
UniqueId=R1-UID
`
    )
    const bundle = ProjectDesignBundleBuilder.build({
        projectModel,
        documentModels: createDocumentModels(),
        annotationModels: [annotationModel]
    })
    const view = ProjectVariantViewBuilder.build(bundle, {
        variantName: 'Assembly C'
    })

    assert.deepEqual(bundle.annotations.mappings, [
        {
            index: 1,
            sourceDesignator: 'U1',
            compiledDesignator: 'U101',
            uniqueId: 'U1-UID',
            sourceFileName: 'assembly.Annotation',
            options: {
                SourceDesignator: 'U1',
                CompiledDesignator: 'U101',
                UniqueId: 'U1-UID'
            }
        },
        {
            index: 2,
            sourceDesignator: 'R1',
            compiledDesignator: 'R201',
            uniqueId: 'R1-UID',
            sourceFileName: 'assembly.Annotation',
            options: {
                SourceDesignator: 'R1',
                CompiledDesignator: 'R201',
                UniqueId: 'R1-UID'
            }
        }
    ])
    assert.deepEqual(
        view.bom.map((row) => ({
            designators: row.designators,
            value: row.value,
            source: row.source,
            pattern: row.pattern,
            alternateFitted: row.alternateFitted
        })),
        [
            {
                designators: ['U101'],
                value: 'Controller C',
                source: 'LOGIC_ALT_LIB',
                pattern: 'QFN_ALT',
                alternateFitted: {
                    designator: 'U1',
                    alternatePart: 'LOGIC_ALT',
                    libReference: 'LOGIC_ALT_LIB',
                    footprint: 'QFN_ALT',
                    comment: 'Controller C',
                    description: 'Alternate controller'
                }
            },
            {
                designators: ['R201'],
                value: '10K',
                source: 'RES_FAKE',
                pattern: '0603_FAKE',
                alternateFitted: null
            }
        ]
    )
    assert.deepEqual(
        view.pnp.entries.map((entry) => entry.designator),
        ['U101', 'R201']
    )
    assert.deepEqual(
        view.nets[0].pins.map((pin) => pin.ownerIndex),
        ['U101', 'R201']
    )
    assert.deepEqual(
        view.components.map((component) => ({
            designator: component.designator,
            sourceDesignator: component.sourceDesignator,
            alternateFitted: component.alternateFitted
        })),
        [
            {
                designator: 'U101',
                sourceDesignator: 'U1',
                alternateFitted: {
                    designator: 'U1',
                    alternatePart: 'LOGIC_ALT',
                    libReference: 'LOGIC_ALT_LIB',
                    footprint: 'QFN_ALT',
                    comment: 'Controller C',
                    description: 'Alternate controller'
                }
            },
            {
                designator: 'R201',
                sourceDesignator: 'R1',
                alternateFitted: null
            }
        ]
    )
})

/**
 * Verifies deterministic wirelist and JSON netlist exports from the normalized
 * project bundle.
 */
test('ProjectNetlistExporter builds deterministic wirelist and netlist JSON', () => {
    const bundle = ProjectDesignBundleBuilder.build({
        projectModel: createProjectModel(),
        documentModels: createDocumentModels()
    })

    assert.equal(
        ProjectNetlistExporter.buildWirelist(bundle),
        [
            '# altium-toolkit wirelist v1',
            'project bundle-check',
            'net NET_A',
            '  R1.2',
            '  U1.1',
            ''
        ].join('\n')
    )
    assert.deepEqual(ProjectNetlistExporter.buildNetlistJson(bundle), {
        schema: 'altium-toolkit.netlist.a1',
        project: 'bundle-check',
        units: {
            coordinate: 'mil',
            length: 'mil'
        },
        nets: [
            {
                name: 'NET_A',
                aliases: ['NET_A'],
                autoNamed: false,
                signal: {
                    type: 'normal',
                    baseName: 'NET_A',
                    suffix: '',
                    sourceHints: []
                },
                pins: [
                    {
                        component: 'R1',
                        pin: '2',
                        name: 'RES_A',
                        hierarchyPath: ['Main.SchDoc'],
                        endpoints: [
                            {
                                kind: 'schematic-pin',
                                key: 'Main.SchDoc:pin:R1.2',
                                sheet: 'Main.SchDoc',
                                component: 'R1',
                                pin: '2'
                            }
                        ]
                    },
                    {
                        component: 'U1',
                        pin: '1',
                        name: 'CTRL_A',
                        hierarchyPath: ['Main.SchDoc'],
                        endpoints: [
                            {
                                kind: 'schematic-pin',
                                key: 'Main.SchDoc:pin:U1.1',
                                sheet: 'Main.SchDoc',
                                component: 'U1',
                                pin: '1'
                            }
                        ]
                    }
                ],
                sources: [
                    {
                        sheet: 'Main.SchDoc',
                        hierarchyPath: ['Main.SchDoc'],
                        aliases: ['NET_A'],
                        graphicalElements: [
                            {
                                kind: 'segment',
                                key: 'Main.SchDoc:segment:0',
                                x1: 20,
                                y1: 60,
                                x2: 160,
                                y2: 60
                            },
                            {
                                kind: 'label',
                                key: 'Main.SchDoc:label:0',
                                text: 'NET_A',
                                x: 70,
                                y: 60
                            }
                        ]
                    }
                ],
                pcb: [
                    {
                        fileName: 'Board.PcbDoc',
                        netIndex: 0,
                        uniqueId: 'NET-1'
                    }
                ]
            }
        ]
    })
})

/**
 * Verifies richer JSON netlists classify signal shapes and retain provenance
 * that is intentionally omitted from the plain wirelist.
 */
test('ProjectNetlistExporter classifies signals and keeps multipart pin provenance', () => {
    const netlist = ProjectNetlistExporter.buildNetlistJson({
        project: { name: 'signal-check' },
        nets: [
            {
                name: 'DATA[3]',
                pins: [
                    {
                        ownerIndex: 'U1',
                        designator: '3',
                        name: 'D3',
                        ownerPartId: 'PART-A',
                        partUniqueId: 'PART-A@Assembly B',
                        isMultiPart: true
                    },
                    {
                        ownerIndex: 'U1',
                        designator: '3',
                        name: 'D3',
                        ownerPartId: 'PART-A',
                        partUniqueId: 'PART-A@Assembly B',
                        isMultiPart: true
                    }
                ],
                schematic: [
                    {
                        fileName: 'Signals.SchDoc',
                        hierarchyPath: ['Top', 'Signals'],
                        pins: [
                            {
                                ownerIndex: 'U1',
                                designator: '3',
                                name: 'D3',
                                ownerPartId: 'PART-A',
                                partUniqueId: 'PART-A@Assembly B',
                                isMultiPart: true
                            }
                        ],
                        labels: [{ text: 'DATA[3]', x: 70, y: 60 }],
                        segments: [{ x1: 20, y1: 60, x2: 90, y2: 60 }]
                    }
                ]
            },
            {
                name: 'DATA[0..7]',
                pins: [],
                schematic: [
                    {
                        fileName: 'Signals.SchDoc',
                        hierarchyPath: ['Top', 'Signals'],
                        segments: [
                            {
                                x1: 20,
                                y1: 90,
                                x2: 90,
                                y2: 90,
                                isBus: true
                            }
                        ],
                        busEntries: [{ x1: 40, y1: 90, x2: 40, y2: 70 }],
                        labels: [{ text: 'DATA[0..7]', x: 70, y: 90 }]
                    }
                ]
            },
            {
                name: 'CTRL_H',
                pins: [],
                schematic: [
                    {
                        fileName: 'Harness.SchDoc',
                        hierarchyPath: ['Top', 'Harness'],
                        harnesses: [
                            {
                                key: 'harness-0',
                                name: 'CTRL_H',
                                entries: ['CTRL_A', 'CTRL_B']
                            }
                        ],
                        sheetEntries: [
                            {
                                name: 'CTRL_H',
                                harnessType: 'CTRL_GROUP',
                                x: 20,
                                y: 60
                            }
                        ]
                    }
                ]
            }
        ]
    })

    assert.deepEqual(
        netlist.nets.map((net) => ({
            name: net.name,
            signal: net.signal
        })),
        [
            {
                name: 'CTRL_H',
                signal: {
                    type: 'harness',
                    baseName: 'CTRL_H',
                    suffix: '',
                    sourceHints: ['harness']
                }
            },
            {
                name: 'DATA[0..7]',
                signal: {
                    type: 'wide',
                    baseName: 'DATA',
                    suffix: '[0..7]',
                    sourceHints: ['bus']
                }
            },
            {
                name: 'DATA[3]',
                signal: {
                    type: 'sub',
                    baseName: 'DATA',
                    suffix: '[3]',
                    sourceHints: []
                }
            }
        ]
    )
    assert.deepEqual(netlist.nets[2].pins, [
        {
            component: 'U1',
            pin: '3',
            name: 'D3',
            hierarchyPath: ['Top', 'Signals'],
            ownerPartId: 'PART-A',
            partUniqueId: 'PART-A@Assembly B',
            isMultiPart: true,
            alternatePartSuffix: 'Assembly B',
            duplicateOccurrences: [
                {
                    component: 'U1',
                    pin: '3',
                    name: 'D3',
                    ownerPartId: 'PART-A',
                    partUniqueId: 'PART-A@Assembly B',
                    isMultiPart: true,
                    alternatePartSuffix: 'Assembly B'
                }
            ],
            endpoints: [
                {
                    kind: 'schematic-pin',
                    key: 'Signals.SchDoc:pin:U1.3',
                    sheet: 'Signals.SchDoc',
                    component: 'U1',
                    pin: '3'
                }
            ]
        }
    ])
})
