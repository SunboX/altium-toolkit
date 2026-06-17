// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { NormalizedModelSchema as ExportedNormalizedModelSchema } from '../../src/parser.mjs'
import { AltiumParser } from '../../src/core/altium/AltiumParser.mjs'
import { IntLibModelParser } from '../../src/core/altium/IntLibModelParser.mjs'
import { NormalizedModelSchema } from '../../src/core/altium/NormalizedModelSchema.mjs'
import { PcbLibModelParser } from '../../src/core/altium/PcbLibModelParser.mjs'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'
import { DraftsmanDigestParser } from '../../src/core/altium/DraftsmanDigestParser.mjs'
import { ProjectAnnotationParser } from '../../src/core/altium/ProjectAnnotationParser.mjs'
import { ProjectDesignBundleBuilder } from '../../src/core/altium/ProjectDesignBundleBuilder.mjs'
import { PrjPcbModelParser } from '../../src/core/altium/PrjPcbModelParser.mjs'
import { PrjScrModelParser } from '../../src/core/altium/PrjScrModelParser.mjs'

/**
 * Encodes text as an ArrayBuffer.
 * @param {string} text
 * @returns {ArrayBuffer}
 */
function encodeText(text) {
    const bytes = new TextEncoder().encode(text)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
}

test('normalized parser roots expose the current schema id', () => {
    const schematicModel = AltiumParser.parseArrayBuffer(
        'schema-check.SchDoc',
        encodeText(
            '|HEADER=Schematic Document' +
                '|RECORD=31|CustomX=100|CustomY=100|BorderOn=F|TitleBlockOn=F'
        )
    )
    const pcbModel = PcbModelParser.parse('schema-check.PcbDoc', [])
    const pcbLibraryModel = PcbLibModelParser.parse('schema-check.PcbLib', {
        footprints: []
    })
    const projectModel = PrjPcbModelParser.parseText(
        'schema-check.PrjPcb',
        '[Design]\nVersion=1.0\n'
    )
    const scriptProjectModel = PrjScrModelParser.parseText(
        'schema-check.PrjScr',
        '[Design]\nVersion=1.0\n'
    )
    const annotationModel = ProjectAnnotationParser.parseText(
        'schema-check.Annotation',
        '[Annotation1]\nSourceDesignator=U1\nCompiledDesignator=U101\n'
    )
    const integratedLibraryModel = IntLibModelParser.parse(
        'schema-check.IntLib',
        {
            sources: []
        }
    )
    const draftsmanModel = DraftsmanDigestParser.parse(
        'schema-check.PCBDwf',
        encodeText('<DraftsmanDocument><Page Id="P1" /></DraftsmanDocument>')
    )
    const designBundleModel = ProjectDesignBundleBuilder.build({
        projectModel,
        documentModels: []
    })

    assert.deepEqual(
        [
            schematicModel,
            pcbModel,
            pcbLibraryModel,
            projectModel,
            scriptProjectModel,
            annotationModel,
            integratedLibraryModel,
            draftsmanModel,
            designBundleModel
        ].map((model) => model.schema),
        Array(9).fill(NormalizedModelSchema.CURRENT_SCHEMA_ID)
    )
    assert.equal(
        ExportedNormalizedModelSchema.CURRENT_SCHEMA_ID,
        NormalizedModelSchema.CURRENT_SCHEMA_ID
    )
    assert.equal(
        schematicModel.diagnostics.every(
            (diagnostic) => typeof diagnostic.code === 'string'
        ),
        true
    )
})

test('machine-readable normalized model schema declares the emitted contract id', () => {
    const schema = JSON.parse(
        fs.readFileSync(
            new URL(
                '../../docs/schemas/altium_toolkit/normalized_model_a1.schema.json',
                import.meta.url
            ),
            'utf8'
        )
    )

    assert.equal(schema.$id, NormalizedModelSchema.CURRENT_SCHEMA_ID)
    assert.equal(schema.properties.schema.const, schema.$id)
    assert.deepEqual(schema.properties.kind.enum, [
        'schematic',
        'pcb',
        'pcb-library',
        'schematic-library',
        'project',
        'project-script',
        'project-annotation',
        'integrated-library',
        'draftsman',
        'design-bundle'
    ])
    assert.deepEqual(schema.properties.fileType.enum, [
        'SchDoc',
        'PcbDoc',
        'PcbLib',
        'SchLib',
        'PrjPcb',
        'PrjScr',
        'Annotation',
        'IntLib',
        'PCBDwf',
        'ProjectDesignBundle'
    ])
})

test('machine-readable normalized model schema declares parser detail contracts', () => {
    const schema = JSON.parse(
        fs.readFileSync(
            new URL(
                '../../docs/schemas/altium_toolkit/normalized_model_a1.schema.json',
                import.meta.url
            ),
            'utf8'
        )
    )

    assert.equal(
        schema.properties.schematic.properties.recordTypes.items.$ref,
        '#/$defs/schematicRecordType'
    )
    assert.equal(
        schema.properties.diagnostics.items.properties.code.type,
        'string'
    )
    assert.equal(
        schema.properties.schematic.properties.directiveSemantics.type,
        'object'
    )
    assert.equal(
        schema.properties.schematic.properties.ownership.$ref,
        '#/$defs/ownershipSidecar'
    )
    assert.equal(
        schema.properties.schematic.properties.hyperlinks.items.$ref,
        '#/$defs/schematicHyperlink'
    )
    assert.equal(
        schema.properties.pcb.properties.vias.items.$ref,
        '#/$defs/pcbVia'
    )
    assert.equal(
        schema.properties.pcb.properties.pads.items.$ref,
        '#/$defs/pcbPad'
    )
    assert.equal(
        schema.properties.pcb.properties.viaStructures.$ref,
        '#/$defs/pcbViaStructures'
    )
    assert.equal(
        schema.properties.pcb.properties.extendedPrimitiveInformation.$ref,
        '#/$defs/pcbExtendedPrimitiveInformation'
    )
    assert.equal(
        schema.properties.pcb.properties.customPadShapes.$ref,
        '#/$defs/pcbCustomPadShapes'
    )
    assert.equal(
        schema.properties.pcb.properties.unions.$ref,
        '#/$defs/pcbUnions'
    )
    assert.equal(
        schema.properties.integratedLibrary.$ref,
        '#/$defs/integratedLibrary'
    )
    assert.equal(schema.properties.draftsman.$ref, '#/$defs/draftsmanDigest')
    assert.equal(
        schema.properties.pcb.properties.dimensions.items.$ref,
        '#/$defs/pcbDimension'
    )
    assert.equal(
        schema.properties.pcb.properties.mechanicalLayerPairs.type,
        'array'
    )
    assert.equal(
        schema.properties.pcb.properties.layerFlipMetadata.type,
        'object'
    )
    assert.equal(
        schema.properties.pcb.properties.ownership.$ref,
        '#/$defs/ownershipSidecar'
    )
    assert.equal(
        schema.properties.pcb.properties.reviewMetadata.$ref,
        '#/$defs/pcbReviewMetadata'
    )
    assert.equal(
        schema.properties.pcb.properties.footprintExtractionManifest.$ref,
        '#/$defs/pcbPlacedFootprintExtraction'
    )
    assert.equal(
        schema.properties.pcb.properties.layerStackReadModel.$ref,
        '#/$defs/pcbLayerStackReadModel'
    )
    assert.equal(
        schema.properties.pcb.properties.bomProfile.$ref,
        '#/$defs/pcbBomProfile'
    )
    assert.equal(
        schema.$defs.pcbLayerStackReadModel.properties.fidelityReport.$ref,
        '#/$defs/pcbLayerStackFidelityReport'
    )
    assert.equal(schema.$defs.draftsmanDigest.properties.styles.type, 'object')
    assert.equal(
        schema.properties.pcb.properties.rigidFlexTopology.$ref,
        '#/$defs/pcbRigidFlexTopology'
    )
    assert.equal(
        schema.properties.pcbLibrary.properties.parityReport.$ref,
        '#/$defs/pcbLibraryParityReport'
    )
    assert.equal(
        schema.properties.schematicLibrary.properties.qa.$ref,
        '#/$defs/libraryQaReport'
    )
    assert.equal(
        schema.properties.pcb.properties.components.items.properties
            .componentKind.$ref,
        '#/$defs/componentKindPolicy'
    )
    assert.equal(
        schema.properties.project.properties.outJobDigest.$ref,
        '#/$defs/projectOutJobDigest'
    )
    assert.equal(
        schema.properties.draftsman.properties.boardViewMetadata.$ref,
        '#/$defs/draftsmanBoardViewCache'
    )
    assert.equal(
        schema.$defs.draftsmanBoardViewCache.properties.highlightGroups.type,
        'array'
    )
    assert.equal(
        schema.$defs.draftsmanBoardViewCache.properties.layerTiles.type,
        'array'
    )
    assert.equal(
        schema.properties.reconciliation.$ref,
        '#/$defs/projectBomPnpReconciliation'
    )
    assert.equal(
        schema.properties.sheets.items.$ref,
        '#/$defs/designBundleSheet'
    )
    assert.equal(
        schema.properties.project.properties.documentGraph.$ref,
        '#/$defs/projectDocumentGraph'
    )
    assert.equal(schema.properties.projectScript.type, 'object')
    assert.equal(schema.properties.annotations.type, 'object')
    assert.equal(
        schema.properties.effectiveVariant.$ref,
        '#/$defs/effectiveVariantView'
    )
    assert.equal(
        schema.$defs.pcbVia.properties.holeTolerance.$ref,
        '#/$defs/holeTolerance'
    )
    assert.equal(
        schema.$defs.pcbVia.properties.drill.$ref,
        '#/$defs/drillMetadata'
    )
    assert.equal(
        schema.$defs.pcbPad.properties.holeTolerance.$ref,
        '#/$defs/holeTolerance'
    )
})

test('machine-readable contract schemas are split for downstream consumers', () => {
    const schemaFiles = [
        [
            '../../docs/schemas/altium_toolkit/project_bundle_a1.schema.json',
            'urn:altium-toolkit:project-bundle:a1',
            NormalizedModelSchema.CURRENT_SCHEMA_ID
        ],
        [
            '../../docs/schemas/altium_toolkit/netlist_a1.schema.json',
            'altium-toolkit.netlist.a1',
            'altium-toolkit.netlist.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/schematic_svg_semantics_a1.schema.json',
            'altium-toolkit.schematic.svg.semantics.a1',
            'altium-toolkit.schematic.svg.semantics.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/pcb_svg_semantics_a1.schema.json',
            'altium-toolkit.pcb.svg.semantics.a1',
            'altium-toolkit.pcb.svg.semantics.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/ci_artifact_bundle_a1.schema.json',
            'altium-toolkit.ci.artifact-bundle.a1',
            'altium-toolkit.ci.artifact-bundle.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/contract_gate_a1.schema.json',
            'altium-toolkit.contract-gate.a1',
            'altium-toolkit.contract-gate.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/project_document_graph_a1.schema.json',
            'altium-toolkit.project.document-graph.a1',
            'altium-toolkit.project.document-graph.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/draftsman_digest_a1.schema.json',
            'altium-toolkit.draftsman.digest.a1',
            'altium-toolkit.draftsman.digest.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/svg_model_cross_link_a1.schema.json',
            'altium-toolkit.svg-model-cross-link.a1',
            'altium-toolkit.svg-model-cross-link.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/parser_compatibility_fuzz_a1.schema.json',
            'altium-toolkit.parser-compatibility-fuzz.a1',
            'altium-toolkit.parser-compatibility-fuzz.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/parser_diagnostics_a1.schema.json',
            'altium-toolkit.parser-diagnostics.a1',
            'altium-toolkit.parser-diagnostics.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/parser_value_verification_a1.schema.json',
            'altium-toolkit.parser-value-verification.a1',
            'altium-toolkit.parser-value-verification.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/parameter_record_inventory_a1.schema.json',
            'altium-toolkit.parameter-record-inventory.a1',
            'altium-toolkit.parameter-record-inventory.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/geometry_bounds_a1.schema.json',
            'altium-toolkit.geometry-bounds.a1',
            'altium-toolkit.geometry-bounds.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/fixture_coverage_matrix_a1.schema.json',
            'altium-toolkit.fixture-coverage-matrix.a1',
            'altium-toolkit.fixture-coverage-matrix.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/unsupported_features_a1.schema.json',
            'altium-toolkit.unsupported-features.a1',
            'altium-toolkit.unsupported-features.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/host_capabilities_a1.schema.json',
            'altium-toolkit.host-capabilities.a1',
            'altium-toolkit.host-capabilities.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/pcb_review_metadata_a1.schema.json',
            'altium-toolkit.pcb.review-metadata.a1',
            'altium-toolkit.pcb.review-metadata.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/pcb_placed_footprint_extraction_a1.schema.json',
            'altium-toolkit.pcb.placed-footprint-extraction.a1',
            'altium-toolkit.pcb.placed-footprint-extraction.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/pcblib_parity_a1.schema.json',
            'altium-toolkit.pcblib.parity.a1',
            'altium-toolkit.pcblib.parity.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/project_outjob_digest_a1.schema.json',
            'altium-toolkit.project.outjob-digest.a1',
            'altium-toolkit.project.outjob-digest.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/library_qa_a1.schema.json',
            'altium-toolkit.library.qa.a1',
            'altium-toolkit.library.qa.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/library_compatibility_a1.schema.json',
            'altium-toolkit.library.compatibility.a1',
            'altium-toolkit.library.compatibility.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/library_merge_plan_a1.schema.json',
            'altium-toolkit.library.merge-plan.a1',
            'altium-toolkit.library.merge-plan.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/library_diff_a1.schema.json',
            'altium-toolkit.library.diff.a1',
            'altium-toolkit.library.diff.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/library_inspection_a1.schema.json',
            'altium-toolkit.library.inspection.a1',
            'altium-toolkit.library.inspection.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/embedded_assets_a1.schema.json',
            'altium-toolkit.embedded-assets.a1',
            'altium-toolkit.embedded-assets.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/pcb_net_membership_a1.schema.json',
            'altium-toolkit.pcb.net-membership.a1',
            'altium-toolkit.pcb.net-membership.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/pcb_class_report_a1.schema.json',
            'altium-toolkit.pcb.class-report.a1',
            'altium-toolkit.pcb.class-report.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/pcb_inspection_a1.schema.json',
            'altium-toolkit.pcb.inspection.a1',
            'altium-toolkit.pcb.inspection.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/schematic_render_ops_a1.schema.json',
            'altium-toolkit.schematic.render-ops.a1',
            'altium-toolkit.schematic.render-ops.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/project_script_a1.schema.json',
            'altium-toolkit.project-script.a1',
            'altium-toolkit.project-script.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/project_bom_pnp_reconciliation_a1.schema.json',
            'altium-toolkit.project.bom-pnp-reconciliation.a1',
            'altium-toolkit.project.bom-pnp-reconciliation.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/draftsman_board_view_cache_a1.schema.json',
            'altium-toolkit.draftsman.board-view-cache.a1',
            'altium-toolkit.draftsman.board-view-cache.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/pcb_layer_stack_a1.schema.json',
            'altium-toolkit.pcb.layer-stack.a1',
            'altium-toolkit.pcb.layer-stack.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/pcb_layer_stack_fidelity_a1.schema.json',
            'altium-toolkit.pcb.layer-stack-fidelity.a1',
            'altium-toolkit.pcb.layer-stack-fidelity.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/pcb_bom_profile_a1.schema.json',
            'altium-toolkit.pcb.bom-profile.a1',
            'altium-toolkit.pcb.bom-profile.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/schematic_template_extraction_a1.schema.json',
            'altium-toolkit.schematic.template-extraction.a1',
            'altium-toolkit.schematic.template-extraction.a1'
        ],
        [
            '../../docs/schemas/altium_toolkit/pcb_rigid_flex_topology_a1.schema.json',
            'altium-toolkit.pcb.rigid-flex-topology.a1',
            'altium-toolkit.pcb.rigid-flex-topology.a1'
        ]
    ]

    for (const [filePath, schemaId, emittedSchemaId] of schemaFiles) {
        const schema = JSON.parse(
            fs.readFileSync(new URL(filePath, import.meta.url), 'utf8')
        )

        assert.equal(schema.$id, schemaId)
        assert.equal(schema.properties.schema.const, emittedSchemaId)
        assert.equal(schema.additionalProperties, true)
    }
})
