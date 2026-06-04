// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { NormalizedModelSchema } from './NormalizedModelSchema.mjs'
import { ParserUtils } from './ParserUtils.mjs'
import { LibraryRenderManifestBuilder } from './LibraryRenderManifestBuilder.mjs'
import { PcbCustomPadShapeParser } from './PcbCustomPadShapeParser.mjs'
import { PcbDefaultsParser } from './PcbDefaultsParser.mjs'
import { PcbExtendedPrimitiveInformationParser } from './PcbExtendedPrimitiveInformationParser.mjs'
import { PcbMaskPasteResolver } from './PcbMaskPasteResolver.mjs'

const { stripExtension } = ParserUtils

/**
 * Normalizes extracted PcbLib stream data into the public parser model.
 */
export class PcbLibModelParser {
    /**
     * Parses one extracted PcbLib into a normalized read-only model.
     * @param {string} fileName
     * @param {{ libraryHeader?: Record<string, string>, componentParamsToc?: Record<string, object>, sectionKeys?: Record<string, string>, footprints?: object[], embeddedFonts?: { fonts?: object[] }, streamNames?: string[], diagnostics?: Record<string, number> } | null} extraction
     * @returns {{ schema: string, kind: 'pcb-library', fileType: 'PcbLib', fileName: string, summary: Record<string, number | string>, diagnostics: { severity: 'info' | 'warning', message: string }[], pcbLibrary: { libraryHeader: Record<string, string>, componentParamsToc: Record<string, object>, sectionKeys: Record<string, string>, footprints: object[], embeddedFonts: object[] }, bom: [] }}
     */
    static parse(fileName, extraction) {
        const safeExtraction = extraction || {}
        const embeddedModels = Array.isArray(
            safeExtraction.embeddedModels?.models
        )
            ? safeExtraction.embeddedModels.models
            : []
        const componentBodies = Array.isArray(
            safeExtraction.embeddedModels?.componentBodies
        )
            ? safeExtraction.embeddedModels.componentBodies
            : []
        const footprints = Array.isArray(safeExtraction.footprints)
            ? safeExtraction.footprints.map((footprint) =>
                  PcbLibModelParser.#normalizeFootprint(
                      footprint,
                      embeddedModels
                  )
              )
            : []
        const embeddedFonts = Array.isArray(safeExtraction.embeddedFonts?.fonts)
            ? safeExtraction.embeddedFonts.fonts
            : []
        const defaults = PcbDefaultsParser.parse(
            safeExtraction.libraryHeader || {},
            'pcb-library'
        )
        const summary = PcbLibModelParser.#buildSummary(
            fileName,
            footprints,
            embeddedFonts,
            embeddedModels
        )
        const diagnostics = PcbLibModelParser.#buildDiagnostics(
            footprints,
            embeddedFonts,
            embeddedModels,
            safeExtraction
        )
        const pcbLibrary = {
            libraryHeader: safeExtraction.libraryHeader || {},
            componentParamsToc: safeExtraction.componentParamsToc || {},
            sectionKeys: safeExtraction.sectionKeys || {},
            footprints,
            indexes: PcbLibModelParser.#buildIndexes(footprints),
            embeddedFonts,
            embeddedModels,
            componentBodies,
            ...(defaults ? { defaults } : {})
        }
        pcbLibrary.renderManifest =
            LibraryRenderManifestBuilder.buildPcbLibraryManifest(pcbLibrary)

        return NormalizedModelSchema.attach({
            kind: 'pcb-library',
            fileType: 'PcbLib',
            fileName,
            summary,
            diagnostics,
            pcbLibrary,
            bom: []
        })
    }

    /**
     * Creates summary counters across all footprints.
     * @param {string} fileName
     * @param {object[]} footprints
     * @param {object[]} embeddedFonts
     * @param {object[]} embeddedModels
     * @returns {Record<string, number | string>}
     */
    static #buildSummary(fileName, footprints, embeddedFonts, embeddedModels) {
        return {
            title: stripExtension(fileName),
            footprintCount: footprints.length,
            primitiveCount: PcbLibModelParser.#countFamily(
                footprints,
                'primitiveCount'
            ),
            padCount: PcbLibModelParser.#countFamily(footprints, 'pads'),
            trackCount: PcbLibModelParser.#countFamily(footprints, 'tracks'),
            arcCount: PcbLibModelParser.#countFamily(footprints, 'arcs'),
            viaCount: PcbLibModelParser.#countFamily(footprints, 'vias'),
            fillCount: PcbLibModelParser.#countFamily(footprints, 'fills'),
            textCount: PcbLibModelParser.#countFamily(footprints, 'texts'),
            regionCount: PcbLibModelParser.#countFamily(footprints, 'regions'),
            rawRecordCount: PcbLibModelParser.#countFamily(
                footprints,
                'rawRecords'
            ),
            embeddedFontCount: embeddedFonts.length,
            embeddedModelCount: embeddedModels.length
        }
    }

    /**
     * Builds parser diagnostics from extraction metadata.
     * @param {object[]} footprints
     * @param {object[]} embeddedFonts
     * @param {object[]} embeddedModels
     * @param {{ streamNames?: string[], diagnostics?: Record<string, number> }} extraction
     * @returns {{ severity: 'info' | 'warning', message: string }[]}
     */
    static #buildDiagnostics(
        footprints,
        embeddedFonts,
        embeddedModels,
        extraction
    ) {
        const diagnostics = [
            {
                severity: 'info',
                message:
                    'Recovered ' +
                    footprints.length +
                    ' PCB library footprint definitions.'
            }
        ]

        if (Array.isArray(extraction.streamNames)) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered ' +
                    extraction.streamNames.length +
                    ' PcbLib data streams from the compound document.'
            })
        }

        if (embeddedFonts.length) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered ' +
                    embeddedFonts.length +
                    ' embedded PcbLib font payloads.'
            })
        }

        if (embeddedModels.length) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered ' +
                    embeddedModels.length +
                    ' embedded PcbLib model payloads.'
            })
        }

        if (extraction.diagnostics?.missingFootprintCount) {
            diagnostics.push({
                severity: 'warning',
                message:
                    'Skipped ' +
                    extraction.diagnostics.missingFootprintCount +
                    ' declared PcbLib footprint storages that were not found.'
            })
        }

        return diagnostics
    }

    /**
     * Normalizes one extracted footprint object with stable primitive arrays.
     * @param {object} footprint
     * @param {object[]} libraryEmbeddedModels Library-level embedded models.
     * @returns {object}
     */
    static #normalizeFootprint(footprint, libraryEmbeddedModels = []) {
        const normalized = {
            name: String(footprint.name || ''),
            dataName: String(footprint.dataName || footprint.name || ''),
            sourceStorage: String(footprint.sourceStorage || ''),
            declaredPrimitiveCount: Number(
                footprint.declaredPrimitiveCount || 0
            ),
            parameters: footprint.parameters || {},
            componentParams: footprint.componentParams || {},
            wideStrings: footprint.wideStrings || {},
            primitiveOrder: Array.isArray(footprint.primitiveOrder)
                ? footprint.primitiveOrder
                : [],
            unknownRecords: Array.isArray(footprint.unknownRecords)
                ? footprint.unknownRecords
                : [],
            implementations: PcbLibModelParser.#array(
                footprint.implementations
            ),
            componentModels: PcbLibModelParser.#array(
                footprint.componentModels
            ),
            pinDisplayModes: footprint.pinDisplayModes || {},
            rawRecords: PcbLibModelParser.#array(footprint.rawRecords),
            pads: PcbLibModelParser.#array(footprint.pads),
            tracks: PcbLibModelParser.#array(footprint.tracks),
            arcs: PcbLibModelParser.#array(footprint.arcs),
            vias: PcbLibModelParser.#array(footprint.vias),
            fills: PcbLibModelParser.#array(footprint.fills),
            texts: PcbLibModelParser.#array(footprint.texts),
            regions: PcbLibModelParser.#array(footprint.regions),
            shapeBasedRegions: PcbLibModelParser.#array(
                footprint.shapeBasedRegions
            ),
            extendedPrimitiveInformation:
                footprint.extendedPrimitiveInformation || {
                    entries: [],
                    byPrimitiveIndex: {},
                    byPrimitiveKey: {}
                },
            customPadShapes: footprint.customPadShapes || {
                entries: [],
                byPrimitiveIndex: {}
            },
            embeddedModels: PcbLibModelParser.#array(footprint.embeddedModels),
            componentBodies: PcbLibModelParser.#array(footprint.componentBodies)
        }
        normalized.defaults = PcbDefaultsParser.parse(
            {
                ...(footprint.defaults || {}),
                ...(footprint.parameters || {})
            },
            'pcb-library-footprint'
        )
        PcbExtendedPrimitiveInformationParser.attachToPrimitives(
            normalized,
            normalized.extendedPrimitiveInformation
        )
        PcbCustomPadShapeParser.attachToPads(
            normalized.pads,
            normalized.customPadShapes,
            normalized
        )
        normalized.componentBodies = PcbLibModelParser.#annotateComponentBodies(
            normalized.componentBodies,
            normalized.embeddedModels.length
                ? normalized.embeddedModels
                : libraryEmbeddedModels
        )
        normalized.maskPaste = PcbMaskPasteResolver.build({
            pads: normalized.pads,
            vias: normalized.vias,
            rules: footprint.rules || [],
            defaults: normalized.defaults
        })

        return {
            ...normalized,
            primitiveCount:
                Number(footprint.primitiveCount) ||
                normalized.primitiveOrder.length
        }
    }

    /**
     * Adds deterministic projection diagnostics to footprint body records.
     * @param {object[]} componentBodies Component body records.
     * @param {object[]} embeddedModels Embedded model records.
     * @returns {object[]}
     */
    static #annotateComponentBodies(componentBodies, embeddedModels) {
        return componentBodies.map((componentBody) => ({
            ...componentBody,
            projectionDiagnostics: PcbLibModelParser.#projectionDiagnostics(
                componentBody,
                embeddedModels
            )
        }))
    }

    /**
     * Resolves one component-body projection diagnostic.
     * @param {object} componentBody Component body record.
     * @param {object[]} embeddedModels Embedded model records.
     * @returns {{ source: string, reason: string }}
     */
    static #projectionDiagnostics(componentBody, embeddedModels) {
        const matchedModel = (embeddedModels || []).find(
            (model) =>
                PcbLibModelParser.#sameNonEmptyValue(
                    model?.id,
                    componentBody?.modelId
                ) ||
                PcbLibModelParser.#sameNonEmptyValue(
                    model?.checksum,
                    componentBody?.checksum
                ) ||
                PcbLibModelParser.#sameNonEmptyValue(
                    model?.name,
                    componentBody?.name
                )
        )

        if (matchedModel) {
            return {
                source: 'embedded-model',
                reason: 'matched embedded model payload'
            }
        }

        return {
            source: 'fallback',
            reason: 'no embedded model payload matched this body'
        }
    }

    /**
     * Compares two values only when both are present.
     * @param {unknown} left First value.
     * @param {unknown} right Second value.
     * @returns {boolean}
     */
    static #sameNonEmptyValue(left, right) {
        return (
            left !== null &&
            left !== undefined &&
            left !== '' &&
            right !== null &&
            right !== undefined &&
            right !== '' &&
            String(left) === String(right)
        )
    }

    /**
     * Builds footprint lookup indexes for library consumers.
     * @param {object[]} footprints Normalized footprints.
     * @returns {object}
     */
    static #buildIndexes(footprints) {
        const footprintsByName = {}

        for (const [index, footprint] of footprints.entries()) {
            footprintsByName[footprint.name] =
                PcbLibModelParser.#footprintIndexEntry(footprint, index)
        }

        return { footprintsByName }
    }

    /**
     * Builds one footprint index entry.
     * @param {object} footprint Normalized footprint.
     * @param {number} index Footprint index.
     * @returns {object}
     */
    static #footprintIndexEntry(footprint, index) {
        return {
            index,
            name: footprint.name,
            dataName: footprint.dataName,
            sourceStorage: footprint.sourceStorage,
            primitiveCount: footprint.primitiveCount,
            padCount: footprint.pads.length,
            textCount: footprint.texts.length,
            keywords: PcbLibModelParser.#buildFootprintKeywords(footprint)
        }
    }

    /**
     * Builds searchable metadata tokens for one footprint.
     * @param {object} footprint Normalized footprint.
     * @returns {string[]}
     */
    static #buildFootprintKeywords(footprint) {
        return [
            footprint.name,
            footprint.dataName,
            ...Object.values(footprint.parameters || {}),
            ...Object.values(footprint.componentParams || {})
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    }

    /**
     * Counts either a scalar footprint field or an array-valued family.
     * @param {object[]} footprints
     * @param {string} key
     * @returns {number}
     */
    static #countFamily(footprints, key) {
        return footprints.reduce((sum, footprint) => {
            const value = footprint[key]
            return (
                sum + (Array.isArray(value) ? value.length : Number(value) || 0)
            )
        }, 0)
    }

    /**
     * Returns a safe array value.
     * @param {unknown} value
     * @returns {unknown[]}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }
}
