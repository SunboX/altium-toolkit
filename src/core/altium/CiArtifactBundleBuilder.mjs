// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbSvgRenderer } from '../../ui/PcbSvgRenderer.mjs'
import { SchematicSvgRenderer } from '../../ui/SchematicSvgRenderer.mjs'
import { PcbStatisticsBuilder } from './PcbStatisticsBuilder.mjs'
import { ProjectDesignBundleBuilder } from './ProjectDesignBundleBuilder.mjs'
import { ProjectDocumentGraphBuilder } from './ProjectDocumentGraphBuilder.mjs'
import { ProjectNetlistExporter } from './ProjectNetlistExporter.mjs'

/**
 * Builds one deterministic CI artifact package from parsed project documents.
 */
export class CiArtifactBundleBuilder {
    static SCHEMA = 'altium-toolkit.ci.artifact-bundle.a1'

    static #UNITS = {
        coordinate: 'mil',
        length: 'mil',
        board: 'mil',
        pnp: 'mil',
        angle: 'deg'
    }

    static #PNP_UNITS = {
        coordinate: 'mil',
        angle: 'deg'
    }

    /**
     * Builds a deterministic bundle of normalized, rendered, and report outputs.
     * @param {{ projectModel?: object, documentModels?: object[], designBundle?: object, annotationModels?: object[], variantName?: string, renderSchematicSvg?: boolean, renderPcbLayerSvgs?: boolean, schematicSvgOptions?: object }} options Bundle options.
     * @returns {object}
     */
    static build(options = {}) {
        const documentModels = Array.isArray(options.documentModels)
            ? options.documentModels
            : []
        const designBundle =
            options.designBundle ||
            ProjectDesignBundleBuilder.build({
                projectModel: options.projectModel,
                documentModels,
                annotationModels: options.annotationModels || [],
                variantName: options.variantName
            })
        const activeBundle = designBundle.effectiveVariant || designBundle
        const schematicSvgs =
            options.renderSchematicSvg === false
                ? []
                : CiArtifactBundleBuilder.#schematicSvgs(
                      documentModels,
                      options.schematicSvgOptions || {}
                  )
        const pcbLayerSvgs =
            options.renderPcbLayerSvgs === false
                ? []
                : CiArtifactBundleBuilder.#pcbLayerSvgs(documentModels)
        const statistics = CiArtifactBundleBuilder.#statistics(documentModels)
        const diagnostics = CiArtifactBundleBuilder.#diagnostics(
            designBundle,
            documentModels
        )
        const netlistJson =
            ProjectNetlistExporter.buildNetlistJson(activeBundle)
        const documentGraph =
            designBundle.project?.documentGraph ||
            ProjectDocumentGraphBuilder.build(
                options.projectModel?.project || designBundle.project || {}
            )

        return {
            schema: CiArtifactBundleBuilder.SCHEMA,
            summary: {
                normalizedModelCount: documentModels.length,
                schematicSvgCount: schematicSvgs.length,
                pcbLayerSvgCount: pcbLayerSvgs.reduce(
                    (total, entry) => total + entry.layers.length,
                    0
                ),
                netCount: netlistJson.nets.length,
                bomRowCount: (activeBundle.bom || designBundle.bom || [])
                    .length,
                pnpCount: (activeBundle.pnp?.entries || []).length,
                diagnosticCount: diagnostics.length
            },
            units: designBundle.units || CiArtifactBundleBuilder.#UNITS,
            designBundle,
            documentGraph,
            normalizedModels: documentModels,
            netlist: {
                json: netlistJson,
                wirelist: ProjectNetlistExporter.buildWirelist(activeBundle)
            },
            bom: {
                rows: activeBundle.bom || designBundle.bom || []
            },
            pnp: CiArtifactBundleBuilder.#pnp(activeBundle, designBundle),
            schematicSvgs,
            pcbLayerSvgs,
            statistics,
            diagnostics
        }
    }

    /**
     * Resolves a PnP payload with explicit output units.
     * @param {object} activeBundle Effective bundle or variant.
     * @param {object} designBundle Source design bundle.
     * @returns {object}
     */
    static #pnp(activeBundle, designBundle) {
        const pnp = activeBundle.pnp || designBundle.pnp || { entries: [] }

        return {
            units: pnp.units || CiArtifactBundleBuilder.#PNP_UNITS,
            ...pnp
        }
    }

    /**
     * Renders schematic SVG entries.
     * @param {object[]} documentModels Parsed document models.
     * @param {object} renderOptions Schematic SVG render options.
     * @returns {object[]}
     */
    static #schematicSvgs(documentModels, renderOptions) {
        return documentModels
            .filter((model) => model?.kind === 'schematic')
            .map((model) => ({
                fileName: model.fileName || '',
                svg: SchematicSvgRenderer.render(model, renderOptions)
            }))
    }

    /**
     * Renders per-layer PCB SVG entries.
     * @param {object[]} documentModels Parsed document models.
     * @returns {object[]}
     */
    static #pcbLayerSvgs(documentModels) {
        return documentModels
            .filter((model) => model?.kind === 'pcb')
            .map((model) => ({
                fileName: model.fileName || '',
                layers: PcbSvgRenderer.renderLayerSvgs(model)
            }))
    }

    /**
     * Builds statistics package entries.
     * @param {object[]} documentModels Parsed document models.
     * @returns {{ pcb: object[] }}
     */
    static #statistics(documentModels) {
        return {
            pcb: documentModels
                .filter((model) => model?.kind === 'pcb')
                .map((model) => ({
                    fileName: model.fileName || '',
                    statistics:
                        model.pcb?.statistics ||
                        PcbStatisticsBuilder.build(model.pcb || {})
                }))
        }
    }

    /**
     * Collects diagnostics from the bundle and source documents.
     * @param {object} designBundle Composed design bundle.
     * @param {object[]} documentModels Parsed document models.
     * @returns {object[]}
     */
    static #diagnostics(designBundle, documentModels) {
        return [
            ...CiArtifactBundleBuilder.#sourceDiagnostics(
                'design-bundle',
                designBundle.diagnostics || []
            ),
            ...documentModels.flatMap((model) =>
                CiArtifactBundleBuilder.#sourceDiagnostics(
                    model.fileName || model.kind || 'document',
                    model.diagnostics || []
                )
            )
        ]
    }

    /**
     * Adds source labels to diagnostics without changing their codes.
     * @param {string} source Diagnostic source label.
     * @param {object[]} diagnostics Source diagnostics.
     * @returns {object[]}
     */
    static #sourceDiagnostics(source, diagnostics) {
        return (diagnostics || []).map((diagnostic) => ({
            source,
            ...diagnostic
        }))
    }
}
