// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies the reduced embedded dawn-sheet fixture still produces normalized
 * ports, labels, and bus geometry.
 */
test('parseAltiumArrayBuffer parses an embedded fake SchDoc sample', async () => {
    const documentModel = await AltiumFixtureLoader.parseDawnSheet()

    assert.equal(documentModel.kind, 'schematic')
    assert.equal(documentModel.fileType, 'SchDoc')
    assert.equal(documentModel.schematic.components.length, 0)
    assert.equal(documentModel.schematic.lines.length, 14)
    assert.equal(documentModel.schematic.texts.length, 10)
    assert.equal(documentModel.schematic.ports.length, 5)
    assert.equal(
        documentModel.schematic.lines.filter((line) => line.isBus).length,
        2
    )
    assert.equal(documentModel.bom.length, 0)
    assert.equal(documentModel.summary.title, 'SKYLACE-ARC')
})

/**
 * Verifies native-style uppercase schematic fields normalize through the same
 * parser path as mixed-case fake records.
 */
test('parseAltiumArrayBuffer accepts uppercase schematic field keys', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CUSTOMX=200|CUSTOMY=120|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
            '|BORDERON=F|TITLEBLOCKON=F|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4' +
            '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Times New Roman|BOLD1=F|ROTATION1=0' +
            '|RECORD=13|LOCATION.X=20|LOCATION.Y=40|CORNER.X=90|CORNER.Y=40' +
            '|LINEWIDTH=1|COLOR=128|INDEXINSHEET=1' +
            '|RECORD=2|OWNERINDEX=700|OWNERPARTID=1|PINCONGLOMERATE=58|PINLENGTH=20' +
            '|LOCATION.X=120|LOCATION.Y=60|NAME=RUNE_A|DESIGNATOR=1|COLOR=255' +
            '|RECORD=41|LOCATION.X=140|LOCATION.Y=70|COLOR=8388608|FONTID=1' +
            '|TEXT=GLYPH_A|NAME=Designator|OWNERINDEX=700'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'uppercase-fields.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.sheet.width, 200)
    assert.equal(documentModel.schematic.lines.length, 1)
    assert.equal(documentModel.schematic.pins.length, 1)
    assert.equal(documentModel.schematic.texts.length, 1)
    assert.deepEqual(documentModel.schematic.lines[0], {
        x1: 20,
        y1: 40,
        x2: 90,
        y2: 40,
        color: '#800000',
        width: 1,
        lineStyle: 0,
        recordType: '13',
        renderOrder: 1,
        ownerIndex: undefined
    })
    assert.equal(documentModel.schematic.pins[0].name, 'RUNE_A')
    assert.equal(documentModel.schematic.texts[0].text, 'GLYPH_A')
})

/**
 * Verifies schematic parsing exposes parent/child ownership without requiring
 * consumers to interpret raw owner-index conventions.
 */
test('parseAltiumArrayBuffer exposes schematic ownership graph sidecar', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=1|IndexInSheet=20|Location.X=80|Location.Y=90|LibReference=BOX_A|UniqueID=CMP-A' +
            '|RECORD=2|OwnerIndex=20|OwnerPartID=1|PinConglomerate=58|PinLength=20' +
            '|Location.X=100|Location.Y=90|Name=SIG_A|Designator=1|Color=255' +
            '|RECORD=41|OwnerIndex=20|Location.X=70|Location.Y=105|Color=8388608|FontID=1' +
            '|Text=U1|Name=Designator|IsHidden=F' +
            '|RECORD=15|IndexInSheet=40|Location.X=160|Location.Y=130|XSize=80|YSize=50|UniqueId=SHEET-A' +
            '|RECORD=16|OwnerIndex=40|Name=CHILD_A|Side=0|DistanceFromTop=2|IOType=2|Style=0'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'ownership-sidecar.SchDoc',
        arrayBuffer
    )
    const ownership = documentModel.schematic.ownership

    assert.equal(ownership.schema, 'altium-toolkit.schematic.ownership.a1')
    assert.deepEqual(
        ownership.childrenByParentKey['schematic-record-1'].map(
            (child) => child.recordType
        ),
        ['2', '41']
    )
    assert.deepEqual(
        ownership.childrenByParentKey['schematic-record-4'].map(
            (child) => child.recordType
        ),
        ['16']
    )
    assert.deepEqual(ownership.parentsByChildKey['schematic-record-2'], {
        parentKey: 'schematic-record-1',
        ownerIndex: '20'
    })
    assert.deepEqual(
        ownership.hierarchy.map((record) => ({
            key: record.key,
            recordType: record.recordType,
            childTypes: (record.children || []).map((child) => child.recordType)
        })),
        [
            {
                key: 'schematic-record-0',
                recordType: '31',
                childTypes: []
            },
            {
                key: 'schematic-record-1',
                recordType: '1',
                childTypes: ['2', '41']
            },
            {
                key: 'schematic-record-4',
                recordType: '15',
                childTypes: ['16']
            }
        ]
    )
    assert.deepEqual(
        ownership.hierarchy
            .find((record) => record.key === 'schematic-record-1')
            .children.map((child) => child.key),
        ['schematic-record-2', 'schematic-record-3']
    )
    assert.equal(ownership.recordsByIndexInSheet['20'].recordType, '1')
    assert.equal(
        ownership.recordsByRecordIndex['1'].fields.LibReference,
        'BOX_A'
    )
    assert.equal(ownership.recordsByIndexInSheet['20'].fields.UniqueID, 'CMP-A')
    assert.equal(
        ownership.records.find((record) => record.recordType === '41').fields
            .Name,
        'Designator'
    )
})

/**
 * Verifies component labels resolve from the native owner display group instead
 * of nearby unrelated symbol text when owner ids do not match IndexInSheet.
 */
test('parseAltiumArrayBuffer resolves schematic component text from following owner group', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=220|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=1|IndexInSheet=20|Location.X=100|Location.Y=100|LibReference=IC/FAKE/CONTROL-HUB|UniqueID=CMP-A' +
            '|RECORD=14|OwnerIndex=300|OwnerPartID=1|Location.X=20|Location.Y=100|Corner.X=80|Corner.Y=190' +
            '|RECORD=2|OwnerIndex=300|OwnerPartID=1|Location.X=80|Location.Y=120|Name=SIG_A|Designator=1' +
            '|RECORD=34|OwnerIndex=300|OwnerPartID=-1|Location.X=20|Location.Y=200|Color=8388608|FontID=1|Text=U7|Name=Designator' +
            '|RECORD=41|OwnerIndex=300|OwnerPartID=-1|Location.X=20|Location.Y=90|Color=8388608|FontID=1|Text=CONTROL-HUB|Name=Comment' +
            '|RECORD=34|OwnerIndex=500|OwnerPartID=-1|Location.X=105|Location.Y=105|Color=8388608|FontID=1|Text=R4|Name=Designator' +
            '|RECORD=41|OwnerIndex=500|OwnerPartID=-1|Location.X=105|Location.Y=115|Color=8388608|FontID=1|Text=4K7|Name=Comment'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'owner-text-group.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.components, [
        {
            x: 100,
            y: 100,
            libReference: 'IC/FAKE/CONTROL-HUB',
            designator: 'U7',
            value: 'CONTROL-HUB',
            uniqueId: 'CMP-A'
        }
    ])
})

/**
 * Verifies explicitly empty library designator/comment owner text remains empty
 * instead of being replaced by a fallback placeholder.
 */
test('parseAltiumArrayBuffer preserves explicitly empty component owner text', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=220|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=1|IndexInSheet=20|Location.X=100|Location.Y=100|LibReference=IC/FAKE/EMPTY-TEXT|UniqueID=CMP-EMPTY' +
            '|RECORD=14|OwnerIndex=300|OwnerPartID=1|Location.X=20|Location.Y=100|Corner.X=80|Corner.Y=190' +
            '|RECORD=2|OwnerIndex=300|OwnerPartID=1|Location.X=80|Location.Y=120|Name=SIG_A|Designator=1' +
            '|RECORD=34|OwnerIndex=300|OwnerPartID=-1|Location.X=20|Location.Y=200|Color=8388608|FontID=1|Text=|Name=Designator' +
            '|RECORD=41|OwnerIndex=300|OwnerPartID=-1|Location.X=20|Location.Y=90|Color=8388608|FontID=1|Text=|Name=Comment'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'empty-owner-text.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.components, [
        {
            x: 100,
            y: 100,
            libReference: 'IC/FAKE/EMPTY-TEXT',
            designator: '',
            value: '',
            uniqueId: 'CMP-EMPTY'
        }
    ])
})

/**
 * Verifies schematic template metadata and template-owned drawing records are
 * exposed as a read-only sidecar for title-block and SVG consumers.
 */
test('parseAltiumArrayBuffer exposes schematic template read model', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|ShowTemplateGraphics=T|TemplateFileName=base-title.SchDot' +
            '|TemplateVaultGUID=VAULT-GUID|TemplateItemGUID=ITEM-GUID|TemplateRevisionGUID=REV-GUID' +
            '|TemplateVaultHRID=Vault A|TemplateRevisionHRID=Revision A' +
            '|RECORD=41|Name=Title|Text=Visible Title|IsHidden=T' +
            '|RECORD=39|IndexInSheet=90|Name=Base Title|UniqueID=TPL-1' +
            '|RECORD=6|OwnerIndex=90|LocationCount=2|X1=20|Y1=150|X2=280|Y2=150|Color=128|LineWidth=1' +
            '|RECORD=4|OwnerIndex=90|Location.X=40|Location.Y=140|Color=8388608|FontID=1|Text==DocCode'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'template-read-model.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.template, {
        schema: 'altium-toolkit.schematic.template.a1',
        identity: {
            showGraphics: true,
            fileName: 'base-title.SchDot',
            vaultGuid: 'VAULT-GUID',
            itemGuid: 'ITEM-GUID',
            revisionGuid: 'REV-GUID',
            vaultHrid: 'Vault A',
            revisionHrid: 'Revision A',
            recordId: 'record-90',
            name: 'Base Title',
            uniqueId: 'TPL-1'
        },
        ownedRecordKeys: ['schematic-record-3', 'schematic-record-4'],
        ownedGraphics: {
            lines: ['schematic-record-3'],
            polygons: [],
            rectangles: [],
            ellipses: [],
            arcs: [],
            texts: ['schematic-record-4'],
            images: []
        },
        fonts: {
            1: {
                size: 10,
                family: 'Times New Roman',
                bold: false,
                italic: false,
                rotation: 0
            }
        },
        missingParameters: ['DocCode'],
        titleBlock: {
            title: 'Visible Title',
            revision: '',
            documentNumber: '',
            sheetNumber: '',
            sheetTotal: '',
            date: '',
            drawnBy: '',
            footerHints: {}
        }
    })
})

/**
 * Verifies harness connector records are normalized as first-class schematic
 * read-model rows with owned entries, type labels, and bundle geometry.
 */
test('parseAltiumArrayBuffer exposes harness connector model', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=215|IndexInSheet=120|Location.X=40|Location.Y=120|XSize=70|YSize=40' +
            '|Side=1|PrimaryConnectionPosition=20|LineWidth=1|Color=128|AreaColor=16777215' +
            '|RECORD=216|OwnerIndex=120|Name=CTRL_A|Side=0|DistanceFromTop=1|DistanceFromTop_Frac1=500000' +
            '|HarnessType=CTRL_GROUP|TextStyle=Short|TextColor=255' +
            '|RECORD=217|OwnerIndex=120|Location.X=40|Location.Y=130|Text=CTRL_GROUP|Color=8388608' +
            '|RECORD=218|LocationCount=2|X1=110|Y1=100|X2=180|Y2=100|Color=15254943|LineWidth=2'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'harness-read-model.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.harnesses, {
        schema: 'altium-toolkit.schematic.harness.a1',
        connectors: [
            {
                key: 'harness-connector-120',
                recordKey: 'schematic-record-1',
                recordId: 'record-120',
                x: 40,
                y: 120,
                width: 70,
                height: 40,
                side: 'right',
                primaryConnectionPosition: 20,
                lineWidth: 1,
                color: '#800000',
                fill: '#ffffff',
                entries: [
                    {
                        key: 'harness-entry-2',
                        recordKey: 'schematic-record-2',
                        name: 'CTRL_A',
                        side: 'left',
                        distanceFromTop: 15,
                        harnessType: 'CTRL_GROUP',
                        textStyle: 'short',
                        textColor: '#ff0000'
                    }
                ],
                typeLabel: {
                    key: 'harness-type-3',
                    recordKey: 'schematic-record-3',
                    text: 'CTRL_GROUP',
                    x: 40,
                    y: 130,
                    color: '#000080'
                }
            }
        ],
        signalHarnesses: [
            {
                key: 'signal-harness-4',
                recordKey: 'schematic-record-4',
                points: [
                    { x: 110, y: 100 },
                    { x: 180, y: 100 }
                ],
                color: '#9fc5e8',
                lineWidth: 2
            }
        ],
        bundleLinks: [
            {
                key: 'harness-bundle-0',
                connectorKey: 'harness-connector-120',
                harnessType: 'CTRL_GROUP',
                entries: ['CTRL_A'],
                signalHarnessKeys: ['signal-harness-4']
            }
        ]
    })
    assert.equal(
        documentModel.schematic.texts.some(
            (text) => text.recordType === '217'
        ),
        false
    )
})

/**
 * Verifies additional-list harness children attach by record structure when
 * the source format omits explicit owner indexes.
 */
test('parseAltiumArrayBuffer attaches implicit harness additional-list children', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=215|Location.X=40|Location.Y=120|XSize=70|YSize=40' +
            '|PrimaryConnectionPosition=20|LineWidth=1|Color=128|AreaColor=16777215' +
            '|RECORD=216|OwnerIndexAdditionalList=T|Name=DATA_P|Side=1|DistanceFromTop=1' +
            '|HarnessType=DATA_BUS|TextStyle=Full|TextColor=255' +
            '|RECORD=216|OwnerIndexAdditionalList=T|Name=DATA_N|Side=1|DistanceFromTop=4' +
            '|HarnessType=DATA_BUS|TextStyle=Full|TextColor=255' +
            '|RECORD=217|OwnerIndexAdditionalList=T|Location.X=40|Location.Y=130' +
            '|Text=DATA_BUS|Color=8388608' +
            '|RECORD=218|LocationCount=2|X1=10|Y1=100|X2=40|Y2=100' +
            '|Color=15254943|LineWidth=2'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'implicit-harness-children.SchDoc',
        arrayBuffer
    )
    const [connector] = documentModel.schematic.harnesses.connectors

    assert.deepEqual(
        connector.entries.map((entry) => ({
            name: entry.name,
            distanceFromTop: entry.distanceFromTop
        })),
        [
            { name: 'DATA_P', distanceFromTop: 10 },
            { name: 'DATA_N', distanceFromTop: 40 }
        ]
    )
    assert.equal(connector.typeLabel.text, 'DATA_BUS')
})

/**
 * Verifies fields recovered before the marker key remain attached to their
 * owning record instead of becoming orphan printable fragments.
 */
test('parseAltiumArrayBuffer preserves fields before record markers', () => {
    const arrayBuffer = new TextEncoder().encode(
        [
            '|HEADER=Schematic Document',
            '|FONTNAME1=Times New Roman|SIZE1=10|BORDERON=T|CUSTOMX=300' +
                '|RECORD=31|CUSTOMY=180|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
                '|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4|FONTIDCOUNT=1',
            '|X4=20|Y4=30|X1=20|Y1=80' +
                '|RECORD=7|LOCATIONCOUNT=4|X2=80|Y2=80|X3=80|Y3=30' +
                '|COLOR=128|AREACOLOR=16776960|ISSOLID=T|LINEWIDTH=1'
        ].join('\u0000')
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'marker-prefix-fields.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.sheet.width, 300)
    assert.equal(documentModel.schematic.sheet.borderOn, true)
    assert.equal(
        documentModel.schematic.sheet.fonts['1'].family,
        'Times New Roman'
    )
    assert.deepEqual(documentModel.schematic.polygons[0].points, [
        { x: 20, y: 80 },
        { x: 80, y: 80 },
        { x: 80, y: 30 },
        { x: 20, y: 30 }
    ])
})

/**
 * Verifies visible template placeholders render after metadata resolution,
 * while internal component and directive parameters stay hidden.
 */
test('parseAltiumArrayBuffer renders visible placeholders without internal parameters', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CUSTOMX=300|CUSTOMY=180|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
            '|BORDERON=T|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4' +
            '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Times New Roman|BOLD1=F|ROTATION1=0' +
            '|RECORD=41|NAME=Title|TEXT=RUNE BOARD|ISHIDDEN=T' +
            '|RECORD=4|LOCATION.X=20|LOCATION.Y=150|COLOR=8388608|FONTID=1|TEXT==Title' +
            '|RECORD=41|LOCATION.X=40|LOCATION.Y=120|NAME=PinUniqueId|TEXT=HIDDEN_PIN_KEY|FONTID=1' +
            '|RECORD=41|LOCATION.X=40|LOCATION.Y=110|NAME=Vendor|TEXT=HIDDEN_VENDOR|FONTID=1' +
            '|RECORD=41|LOCATION.X=40|LOCATION.Y=100|NAME=IC|TEXT=HIDDEN_DEVICE|FONTID=1' +
            '|RECORD=41|LOCATION.X=40|LOCATION.Y=90|NAME=DifferentialPair|TEXT=True|FONTID=1' +
            '|RECORD=41|LOCATION.X=80|LOCATION.Y=70|NAME=Comment|TEXT=VISIBLE_VALUE|FONTID=1'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'visible-placeholder.SchDoc',
        arrayBuffer
    )
    const visibleTexts = documentModel.schematic.texts.map((text) => text.text)

    assert.equal(visibleTexts.includes('RUNE BOARD'), true)
    assert.equal(visibleTexts.includes('VISIBLE_VALUE'), true)
    assert.equal(visibleTexts.includes('HIDDEN_PIN_KEY'), false)
    assert.equal(visibleTexts.includes('HIDDEN_VENDOR'), false)
    assert.equal(visibleTexts.includes('HIDDEN_DEVICE'), false)
    assert.equal(visibleTexts.includes('True'), false)
})

/**
 * Verifies visible Altium special strings stay available for renderer-level
 * project context while unresolved placeholders do not leak into SVG output.
 */
test('renderSchematicSvg resolves visible project special strings', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CUSTOMX=300|CUSTOMY=180|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
            '|BORDERON=T|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4' +
            '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Times New Roman|BOLD1=F|ROTATION1=0' +
            '|RECORD=4|LOCATION.X=20|LOCATION.Y=150|COLOR=8388608|FONTID=1|TEXT==ProjectName' +
            '|RECORD=4|LOCATION.X=20|LOCATION.Y=130|COLOR=8388608|FONTID=1|TEXT==DocumentName'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'visible-special-strings.SchDoc',
        arrayBuffer
    )
    const visibleTexts = documentModel.schematic.texts.map((text) => text.text)
    const unresolvedMarkup = SchematicSvgRenderer.render(documentModel)
    const resolvedMarkup = SchematicSvgRenderer.render(documentModel, {
        projectParameters: {
            ProjectName: 'NEUTRAL_PROJECT.PrjPcb',
            DocumentName: '01_Neutral.SchDoc'
        }
    })

    assert.equal(visibleTexts.includes('=ProjectName'), true)
    assert.equal(visibleTexts.includes('=DocumentName'), true)
    assert.doesNotMatch(unresolvedMarkup, /=ProjectName|=DocumentName/u)
    assert.match(resolvedMarkup, /NEUTRAL_PROJECT\.PrjPcb/u)
    assert.match(resolvedMarkup, /01_Neutral\.SchDoc/u)
})

/**
 * Verifies extended Altium line styles survive parsing and render as a
 * dash-dot frame rather than a solid outline.
 */
test('renderSchematicSvg renders extended dash-dot schematic line style', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CUSTOMX=300|CUSTOMY=180|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
            '|BORDERON=F|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4' +
            '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Times New Roman|BOLD1=F|ROTATION1=0' +
            '|RECORD=6|LOCATIONCOUNT=2|X1=20|Y1=150|X2=240|Y2=150' +
            '|COLOR=8323857|LINEWIDTH=2|LINESTYLEEXT=3|INDEXINSHEET=2'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'dash-dot-line.SchDoc',
        arrayBuffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(documentModel.schematic.lines[0].lineStyle, 3)
    assert.match(markup, /stroke-dasharray="16 10 3 10" stroke-linecap="round"/)
})

/**
 * Verifies wrapped record-28 note boxes stay in the text model and do not
 * leak into the line model as a diagonal location-to-corner segment.
 */
test('parseAltiumArrayBuffer keeps record-28 notes out of schematic lines', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=200|CustomY=100|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=28|Location.X=20|Location.Y=20|Corner.X=120|Corner.Y=60' +
            '|AreaColor=16777215|TextColor=255|FontID=1|IsSolid=T|Alignment=1|WordWrap=T|ClipToRect=T' +
            '|Text=*NOTE:~11)Alpha~12)Beta'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'wrapped-note.SchDoc',
        arrayBuffer
    )
    const note = documentModel.schematic.texts.find(
        (text) => text.recordType === '28'
    )

    assert.ok(note)
    assert.equal(documentModel.schematic.lines.length, 0)
    assert.equal(note.color, '#ff0000')
    assert.deepEqual(note.noteLines, ['*NOTE:', '1)Alpha', '2)Beta'])
    assert.equal(note.cornerX, 120)
    assert.equal(note.cornerY, 60)
})

/**
 * Verifies single-line boxed schematic note titles render centered when Altium
 * omits an explicit text-frame justification field.
 */
test('renderSchematicSvg centers boxed schematic note titles by default', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=240|CustomY=160|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=18|FontName2=Times New Roman|Bold2=T|Rotation2=0' +
            '|RECORD=209|Location.X=40|Location.Y=100|Corner.X=200|Corner.Y=130' +
            '|AreaColor=9895935|TextColor=128|FontID=2|IsSolid=T|ShowBorder=T' +
            '|WordWrap=T|ClipToRect=T|Text=NEUTRAL TITLE|TextMargin=5'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'boxed-title-note.SchDoc',
        arrayBuffer
    )
    const note = documentModel.schematic.texts.find(
        (text) => text.recordType === '209'
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(note.anchor, 'middle')
    assert.match(
        markup,
        /<text class="schematic-note-text" x="120"[^>]*text-anchor="middle"/u
    )
    assert.match(
        markup,
        /<g class="schematic-note">[\s\S]*<rect class="schematic-note-box"[^>]*fill="var\(--schematic-note-fill-color\)" stroke="var\(--schematic-power-color\)"[\s\S]*<text class="schematic-note-text"[^>]*fill="var\(--schematic-power-color\)" text-anchor="middle"/u
    )
    assert.doesNotMatch(markup, /schematic-note--section-title/u)
})

/**
 * Verifies standard-style A3 sheets keep the footer value hints needed to
 * position the synthesized title block like the source page footer.
 */
test('parseAltiumArrayBuffer keeps standard A3 footer title-block hints', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|SheetStyle=1|CustomX=1654|CustomY=1169|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=14|FontName2=Times New Roman|Bold2=T|Rotation2=0' +
            '|RECORD=41|Name=Title|Text=EMBER-UNIT|IsHidden=T' +
            '|RECORD=4|Location.X=1225|Location.Y=75|Color=8388608|FontID=2|Text=EMBER-UNIT Power' +
            '|RECORD=4|Location.X=1420|Location.Y=80|Color=255|FontID=2|Text=CORE-MOD' +
            '|RECORD=4|Location.X=1455|Location.Y=50|Color=8388608|FontID=1|Text=03' +
            '|RECORD=4|Location.X=1405|Location.Y=30|Color=8388608|FontID=1|Text=2' +
            '|RECORD=4|Location.X=1435|Location.Y=30|Color=8388608|FontID=1|Text=7'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'footer-hints.SchDoc',
        arrayBuffer
    )
    const titleBlock = documentModel.schematic.sheet.titleBlock

    assert.equal(documentModel.schematic.sheet.xZones, 8)
    assert.equal(titleBlock.title, 'EMBER-UNIT Power')
    assert.equal(titleBlock.documentNumber, 'CORE-MOD')
    assert.equal(titleBlock.revision, '03')
    assert.equal(titleBlock.sheetNumber, '2')
    assert.equal(titleBlock.sheetTotal, '7')
    assert.deepEqual(titleBlock.footerHints.title, {
        x: 1225,
        y: 75,
        color: '#000080',
        fontSize: 14,
        fontFamily: 'Times New Roman',
        fontWeight: 700
    })
    assert.deepEqual(titleBlock.footerHints.documentNumber, {
        x: 1420,
        y: 80,
        color: '#ff0000',
        fontSize: 14,
        fontFamily: 'Times New Roman',
        fontWeight: 700
    })
    assert.deepEqual(titleBlock.footerHints.revision, {
        x: 1455,
        y: 50,
        color: '#000080',
        fontSize: 10,
        fontFamily: 'Times New Roman',
        fontWeight: 400
    })
})

/**
 * Verifies footer placeholders resolve through hidden sheet metadata and a
 * visible bottom-row signature populates the synthesized `Drawn By` field.
 */
test('parseAltiumArrayBuffer resolves footer placeholders and visible drawn-by values', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=1500|CustomY=950|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=14|FontName2=Times New Roman|Bold2=T|Rotation2=0' +
            '|RECORD=41|Name=Title|Text=EMBER-UNIT Power|IsHidden=T' +
            '|RECORD=41|Name=Revision|Text=03|IsHidden=T' +
            '|RECORD=41|Name=DrawnBy|Text=*|IsHidden=T' +
            '|RECORD=4|Location.X=1900|Location.Y=90|Color=8388608|FontID=2|Text==title' +
            '|RECORD=4|Location.X=2130|Location.Y=90|Color=255|FontID=2|Text=CORE-MOD' +
            '|RECORD=4|Location.X=2125|Location.Y=60|Color=8388608|FontID=1|Text==revision' +
            '|RECORD=4|Location.X=2075|Location.Y=40|Color=8388608|FontID=1|Text=8' +
            '|RECORD=4|Location.X=2105|Location.Y=40|Color=8388608|FontID=1|Text=8' +
            '|RECORD=4|Location.X=2125|Location.Y=30|Color=8388608|FontID=1|Text=OR'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'resolved-footer-placeholders.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.sheet.titleBlock, {
        title: 'EMBER-UNIT Power',
        revision: '03',
        documentNumber: 'CORE-MOD',
        sheetNumber: '8',
        sheetTotal: '8',
        date: '',
        drawnBy: 'OR',
        footerHints: {
            title: {
                x: 1900,
                y: 90,
                color: '#000080',
                fontSize: 14,
                fontFamily: 'Times New Roman',
                fontWeight: 700
            },
            documentNumber: {
                x: 2130,
                y: 90,
                color: '#ff0000',
                fontSize: 14,
                fontFamily: 'Times New Roman',
                fontWeight: 700
            },
            revision: {
                x: 2125,
                y: 60,
                color: '#000080',
                fontSize: 10,
                fontFamily: 'Times New Roman',
                fontWeight: 400
            },
            sheetNumber: {
                x: 2075,
                y: 40,
                color: '#000080',
                fontSize: 10,
                fontFamily: 'Times New Roman',
                fontWeight: 400
            },
            sheetTotal: {
                x: 2105,
                y: 40,
                color: '#000080',
                fontSize: 10,
                fontFamily: 'Times New Roman',
                fontWeight: 400
            }
        }
    })
})

/**
 * Verifies Altium schematic colors, title typography, and synthesized
 * connector notes are normalized from the moon-sheet fixture.
 */
test('parseAltiumArrayBuffer decodes moon sheet colors and wires', async () => {
    const documentModel = await AltiumFixtureLoader.parseMoonSheet()

    assert.equal(documentModel.kind, 'schematic')
    assert.equal(
        documentModel.schematic.texts.some(
            (text) => text.text === 'Zephyr Node' && text.color === '#000080'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.text === 'WYRN' &&
                Math.abs(text.fontSize - 22) < 0.02 &&
                text.anchor === 'start'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.text === 'AURA_3V3' &&
                text.recordType === '17' &&
                text.style === 2 &&
                text.rotation === 0 &&
                text.anchor === 'middle'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) => text.text === 'WYRN' && text.rotation === 90
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.text === 'SIGIL12' &&
                text.rotation === 90 &&
                text.anchor === 'start'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 175 &&
                line.y1 === 545 &&
                line.x2 === 175 &&
                line.y2 === 555 &&
                line.color === '#000080'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some((text) => text.text === '=title'),
        false
    )
    assert.equal(
        documentModel.schematic.texts.some((text) =>
            /@DESIGNATOR|INITIAL VOLTAGE/i.test(text.text)
        ),
        false
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.name === 'EN' &&
                pin.designator === '3' &&
                pin.orientation === 'left' &&
                pin.x === 455 &&
                pin.y === 545 &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) => pin.x === 300 && pin.y === 230
        ),
        false
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.x === 950 &&
                pin.y === 530 &&
                pin.labelMode === 'number-only'
        ),
        true
    )
    assert.deepEqual(documentModel.schematic.sheet.titleBlock, {
        title: 'SKYLACE-ARC',
        revision: '01',
        documentNumber: '',
        sheetNumber: '4',
        sheetTotal: '6',
        date: '',
        drawnBy: '',
        footerHints: {
            sheetNumber: {
                x: 1005,
                y: 30,
                color: '#000080',
                fontSize: 10,
                fontFamily: 'Times New Roman',
                fontWeight: 400
            },
            sheetTotal: {
                x: 1025,
                y: 30,
                color: '#000080',
                fontSize: 10,
                fontFamily: 'Times New Roman',
                fontWeight: 400
            }
        }
    })
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '296' &&
                pin.name === 'A' &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '322' &&
                pin.name === 'A' &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '1231' &&
                pin.x === 695 &&
                pin.y === 535 &&
                pin.orientation === 'left' &&
                pin.labelMode === 'hidden'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '638' &&
                pin.x === 175 &&
                pin.y === 535 &&
                pin.orientation === 'top' &&
                pin.labelMode === 'hidden'
        ),
        true
    )
    assert.equal(documentModel.schematic.sheet.xZones, 4)
    assert.equal(documentModel.schematic.sheet.yZones, 4)
    assert.equal(
        documentModel.schematic.texts.some(
            (text) => text.text === 'SKYLACE-ARC' || text.text === '01'
        ),
        false
    )
    assert.equal(
        documentModel.schematic.crosses.some(
            (cross) =>
                cross.x === 990 && cross.y === 530 && cross.color === '#ff0000'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.ports.some(
            (port) =>
                port.name === 'RUNE_CTL' &&
                port.x === 680 &&
                port.y === 495 &&
                port.width === 60 &&
                port.height === 10
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.filter(
            (text) => text.text === 'RUNE HEADER P2.54 2X3P VERTICAL L=30.5'
        ).length,
        1
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) => text.text === 'RUNE_CTL' || text.text === 'RUNE_FLOW'
        ),
        false
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 690 &&
                line.y1 === 427 &&
                line.x2 === 690 &&
                line.y2 === 425
        ),
        false
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 697 &&
                line.y1 === 535 &&
                line.x2 === 695 &&
                line.y2 === 535
        ),
        true
    )
    assert.deepEqual(
        documentModel.schematic.components
            .filter((component) =>
                [
                    [255, 215],
                    [225, 270],
                    [950, 540],
                    [455, 595]
                ].some(([x, y]) => component.x === x && component.y === y)
            )
            .map((component) => ({
                x: component.x,
                y: component.y,
                designator: component.designator
            }))
            .sort((left, right) => left.x - right.x || left.y - right.y),
        [
            { x: 225, y: 270, designator: 'SIGIL12' },
            { x: 255, y: 215, designator: 'GLINT94' },
            { x: 455, y: 595, designator: 'WYRN6' },
            { x: 950, y: 540, designator: 'PORT6' }
        ]
    )
})

/**
 * Verifies rotated schematic texts preserve their raw Altium orientation so
 * the renderer can distinguish opposite vertical reading directions.
 */
test('parseAltiumArrayBuffer preserves rotated text source orientation', async () => {
    const moonDocument = await AltiumFixtureLoader.parseMoonSheet()
    const cinderDocument = await AltiumFixtureLoader.parseCinderSheet()
    const sigil12Text = moonDocument.schematic.texts.find(
        (text) => text.text === 'SIGIL12'
    )
    const jtag = moonDocument.schematic.texts.find(
        (text) => text.text === 'WYRN'
    )
    const sigil24Text = cinderDocument.schematic.texts.find(
        (text) => text.text === 'SIGIL24'
    )
    const sigil24Value = cinderDocument.schematic.texts.find(
        (text) => text.text === '4K7' && text.ownerIndex === '3652'
    )

    assert.deepEqual(
        {
            text: sigil12Text?.text,
            rotation: sigil12Text?.rotation,
            sourceOrientation: sigil12Text?.sourceOrientation
        },
        {
            text: 'SIGIL12',
            rotation: 90,
            sourceOrientation: 1
        }
    )
    assert.deepEqual(
        {
            text: jtag?.text,
            rotation: jtag?.rotation,
            sourceOrientation: jtag?.sourceOrientation
        },
        {
            text: 'WYRN',
            rotation: 90,
            sourceOrientation: 1
        }
    )
    assert.deepEqual(
        {
            text: sigil24Text?.text,
            rotation: sigil24Text?.rotation,
            sourceOrientation: sigil24Text?.sourceOrientation
        },
        {
            text: 'SIGIL24',
            rotation: 90,
            sourceOrientation: 3
        }
    )
    assert.deepEqual(
        {
            text: sigil24Value?.text,
            rotation: sigil24Value?.rotation,
            sourceOrientation: sigil24Value?.sourceOrientation
        },
        {
            text: '4K7',
            rotation: 90,
            sourceOrientation: 3
        }
    )
})

/**
 * Verifies designator and parameter records decode the native orientation bits:
 * bit 0 rotates the text, and bit 1 anchors the text from the right/top edge.
 */
test('parseAltiumArrayBuffer decodes component text orientation bits', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=240|CustomY=160|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=34|OwnerIndex=700|Location.X=40|Location.Y=80|Color=8388608|FontID=1' +
            '|Text=U7|Name=Designator|Orientation=3',
        '|RECORD=41|OwnerIndex=700|Location.X=70|Location.Y=95|Color=8388608|FontID=1' +
            '|Text=CTRL|Name=Comment|Orientation=2',
        '|RECORD=41|OwnerIndex=700|Location.X=90|Location.Y=110|Color=8388608|FontID=1' +
            '|Text=ALT|Name=Variant|Orientation=1'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'component-text-orientation-bits.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const texts = Object.fromEntries(
        documentModel.schematic.texts.map((text) => [
            text.text,
            {
                rotation: text.rotation,
                sourceOrientation: text.sourceOrientation,
                anchor: text.anchor
            }
        ])
    )

    assert.deepEqual(texts.U7, {
        rotation: 90,
        sourceOrientation: 3,
        anchor: 'end'
    })
    assert.deepEqual(texts.CTRL, {
        rotation: 0,
        sourceOrientation: 2,
        anchor: 'end'
    })
    assert.deepEqual(texts.ALT, {
        rotation: 90,
        sourceOrientation: 1,
        anchor: 'start'
    })
})
