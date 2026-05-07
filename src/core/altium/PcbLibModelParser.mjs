// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { NormalizedModelSchema } from './NormalizedModelSchema.mjs'
import { ParserUtils } from './ParserUtils.mjs'

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
        const footprints = Array.isArray(safeExtraction.footprints)
            ? safeExtraction.footprints.map((footprint) =>
                  PcbLibModelParser.#normalizeFootprint(footprint)
              )
            : []
        const embeddedFonts = Array.isArray(safeExtraction.embeddedFonts?.fonts)
            ? safeExtraction.embeddedFonts.fonts
            : []
        const summary = PcbLibModelParser.#buildSummary(
            fileName,
            footprints,
            embeddedFonts
        )
        const diagnostics = PcbLibModelParser.#buildDiagnostics(
            footprints,
            embeddedFonts,
            safeExtraction
        )

        return NormalizedModelSchema.attach({
            kind: 'pcb-library',
            fileType: 'PcbLib',
            fileName,
            summary,
            diagnostics,
            pcbLibrary: {
                libraryHeader: safeExtraction.libraryHeader || {},
                componentParamsToc: safeExtraction.componentParamsToc || {},
                sectionKeys: safeExtraction.sectionKeys || {},
                footprints,
                embeddedFonts
            },
            bom: []
        })
    }

    /**
     * Creates summary counters across all footprints.
     * @param {string} fileName
     * @param {object[]} footprints
     * @param {object[]} embeddedFonts
     * @returns {Record<string, number | string>}
     */
    static #buildSummary(fileName, footprints, embeddedFonts) {
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
            embeddedFontCount: embeddedFonts.length
        }
    }

    /**
     * Builds parser diagnostics from extraction metadata.
     * @param {object[]} footprints
     * @param {object[]} embeddedFonts
     * @param {{ streamNames?: string[], diagnostics?: Record<string, number> }} extraction
     * @returns {{ severity: 'info' | 'warning', message: string }[]}
     */
    static #buildDiagnostics(footprints, embeddedFonts, extraction) {
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
     * @returns {object}
     */
    static #normalizeFootprint(footprint) {
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
            rawRecords: PcbLibModelParser.#array(footprint.rawRecords),
            pads: PcbLibModelParser.#array(footprint.pads),
            tracks: PcbLibModelParser.#array(footprint.tracks),
            arcs: PcbLibModelParser.#array(footprint.arcs),
            vias: PcbLibModelParser.#array(footprint.vias),
            fills: PcbLibModelParser.#array(footprint.fills),
            texts: PcbLibModelParser.#array(footprint.texts),
            regions: PcbLibModelParser.#array(footprint.regions)
        }

        return {
            ...normalized,
            primitiveCount:
                Number(footprint.primitiveCount) ||
                normalized.primitiveOrder.length
        }
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
