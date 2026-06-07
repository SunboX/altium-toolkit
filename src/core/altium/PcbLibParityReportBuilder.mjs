// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds parity reports for advanced PcbLib footprint fields.
 */
export class PcbLibParityReportBuilder {
    static SCHEMA = 'altium-toolkit.pcblib.parity.a1'

    /**
     * Builds an advanced-field parity report.
     * @param {{ footprints?: object[] }} pcbLibrary Parsed PCB library model.
     * @returns {object}
     */
    static build(pcbLibrary = {}) {
        const footprints = (pcbLibrary.footprints || []).map((footprint) =>
            PcbLibParityReportBuilder.#footprintRow(footprint)
        )
        const summary = PcbLibParityReportBuilder.#summary(footprints)

        return {
            schema: PcbLibParityReportBuilder.SCHEMA,
            summary,
            footprints
        }
    }

    /**
     * Builds one footprint parity row.
     * @param {object} footprint Footprint record.
     * @returns {object}
     */
    static #footprintRow(footprint) {
        const advancedFields = {
            localStackPads: (footprint.pads || []).filter(
                (pad) => pad.localStack
            ).length,
            customPadShapes: footprint.customPadShapes?.entries?.length || 0,
            maskPastePrimitives: footprint.maskPaste?.primitives?.length || 0,
            viaTenting: (footprint.vias || []).filter((via) =>
                PcbLibParityReportBuilder.#hasViaTenting(via)
            ).length,
            barcodeTexts: (footprint.texts || []).filter((text) => text.barcode)
                .length,
            embeddedModels: (footprint.embeddedModels || []).length,
            projectionDiagnostics: (footprint.componentBodies || []).filter(
                (body) => body.projectionDiagnostics
            ).length
        }

        return {
            name: footprint.name || '',
            advancedFields,
            layers: PcbLibParityReportBuilder.#layers(footprint),
            diagnostics: PcbLibParityReportBuilder.#diagnostics(advancedFields)
        }
    }

    /**
     * Builds top-level parity counters.
     * @param {object[]} footprints Footprint parity rows.
     * @returns {object}
     */
    static #summary(footprints) {
        return {
            footprintCount: footprints.length,
            footprintWithAdvancedFieldsCount: footprints.filter((footprint) =>
                Object.values(footprint.advancedFields).some(
                    (value) => Number(value) > 0
                )
            ).length,
            localStackPadCount: PcbLibParityReportBuilder.#sum(
                footprints,
                'localStackPads'
            ),
            customPadFootprintCount: footprints.filter(
                (footprint) => footprint.advancedFields.customPadShapes > 0
            ).length,
            maskPastePrimitiveCount: PcbLibParityReportBuilder.#sum(
                footprints,
                'maskPastePrimitives'
            ),
            viaTentingCount: PcbLibParityReportBuilder.#sum(
                footprints,
                'viaTenting'
            ),
            barcodeTextCount: PcbLibParityReportBuilder.#sum(
                footprints,
                'barcodeTexts'
            ),
            embeddedModelFootprintCount: footprints.filter(
                (footprint) => footprint.advancedFields.embeddedModels > 0
            ).length,
            projectionDiagnosticCount: PcbLibParityReportBuilder.#sum(
                footprints,
                'projectionDiagnostics'
            )
        }
    }

    /**
     * Sums one advanced-field counter.
     * @param {object[]} footprints Footprint rows.
     * @param {string} key Advanced-field key.
     * @returns {number}
     */
    static #sum(footprints, key) {
        return footprints.reduce(
            (total, footprint) =>
                total + Number(footprint.advancedFields?.[key] || 0),
            0
        )
    }

    /**
     * Builds layer descriptors represented by the footprint.
     * @param {object} footprint Footprint record.
     * @returns {object[]}
     */
    static #layers(footprint) {
        const layerMap = new Map()
        for (const primitive of PcbLibParityReportBuilder.#primitives(
            footprint
        )) {
            const layer = PcbLibParityReportBuilder.#layerDescriptor(primitive)
            if (layer) layerMap.set(layer.layerKey, layer)
        }
        return [...layerMap.values()].sort((left, right) =>
            left.layerKey.localeCompare(right.layerKey, undefined, {
                numeric: true
            })
        )
    }

    /**
     * Builds diagnostics for unsupported parity edge cases.
     * @param {object} advancedFields Advanced-field counts.
     * @returns {object[]}
     */
    static #diagnostics(advancedFields) {
        return Object.values(advancedFields).some((value) => Number(value) > 0)
            ? []
            : [
                  {
                      code: 'pcblib.parity.no-advanced-fields',
                      severity: 'info',
                      message:
                          'Footprint does not expose advanced PCB field families.'
                  }
              ]
    }

    /**
     * Returns true when a via preserves tenting metadata.
     * @param {object} via Via primitive.
     * @returns {boolean}
     */
    static #hasViaTenting(via) {
        return [
            via?.topTenting,
            via?.bottomTenting,
            via?.tentingTop,
            via?.tentingBottom,
            via?.solderMaskExpansionMode,
            via?.solderMaskExpansion
        ].some((value) => value !== undefined && value !== null && value !== '')
    }

    /**
     * Returns all footprint primitives that can carry layer metadata.
     * @param {object} footprint Footprint record.
     * @returns {object[]}
     */
    static #primitives(footprint) {
        return [
            ...(footprint.pads || []),
            ...(footprint.vias || []),
            ...(footprint.tracks || []),
            ...(footprint.arcs || []),
            ...(footprint.fills || []),
            ...(footprint.regions || []),
            ...(footprint.shapeBasedRegions || []),
            ...(footprint.texts || [])
        ]
    }

    /**
     * Builds a normalized layer descriptor.
     * @param {object} primitive Primitive row.
     * @returns {object | null}
     */
    static #layerDescriptor(primitive) {
        const layerId = Number.isInteger(primitive?.layerId)
            ? primitive.layerId
            : null
        const displayName = String(
            primitive?.layerName || primitive?.layer || ''
        ).trim()
        if (layerId === null && !displayName) {
            return null
        }
        const layerKey =
            layerId === null
                ? 'layer-' + PcbLibParityReportBuilder.#slug(displayName)
                : 'L' + layerId

        return PcbLibParityReportBuilder.#stripUndefined({
            layerKey,
            layerId: layerId === null ? undefined : layerId,
            displayName: displayName || layerKey
        })
    }

    /**
     * Converts a value to a deterministic lowercase key segment.
     * @param {unknown} value Source value.
     * @returns {string}
     */
    static #slug(value) {
        return (
            String(value || '')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/gu, '-')
                .replace(/^-+|-+$/gu, '') || 'item'
        )
    }

    /**
     * Removes undefined fields.
     * @param {Record<string, unknown>} value Candidate object.
     * @returns {Record<string, unknown>}
     */
    static #stripUndefined(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(
                ([, entryValue]) => entryValue !== undefined
            )
        )
    }
}
